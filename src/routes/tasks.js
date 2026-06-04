const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateTask } = require('../middleware/validation');

const router = express.Router();

// Apply auth to all task routes
router.use(authenticateToken);

// Helper to log activities
async function logActivity(userId, taskTitle, action) {
  try {
    // Ensure table exists (for robust SQLite/MySQL runtime)
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_title TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {
      // MySQL query syntax check fallback in case it fails due to SQLITE-specific syntax
      return db.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          task_title VARCHAR(255) NOT NULL,
          action VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(err => console.error('Failed to create MySQL logs table:', err.message));
    });

    await db.query(
      'INSERT INTO activity_logs (user_id, task_title, action) VALUES (?, ?, ?)',
      [userId, taskTitle, action]
    );
  } catch (err) {
    console.error('Log activity error:', err);
  }
}

// GET /tasks/activities - Get activity logs for current user
router.get('/activities', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch activities error:', error);
    res.status(500).json({ error: 'Internal server error fetching activities.' });
  }
});

// Common handler for fetching tasks to share between GET /tasks, GET /tasks/search, and GET /tasks/filter
const getTasks = async (req, res) => {
  const userId = req.user.id;
  const { status, category_id, priority, search, sortBy, order } = req.query;

  try {
    let sql = `
      SELECT t.*, c.category_name 
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
    const params = [userId];

    // Filters
    if (status) {
      sql += " AND t.status = ?";
      params.push(status);
    }
    if (category_id) {
      sql += " AND t.category_id = ?";
      params.push(category_id);
    }
    if (priority) {
      sql += " AND t.priority = ?";
      params.push(priority);
    }

    // Search
    if (search && search.trim()) {
      sql += " AND (t.title LIKE ? OR t.description LIKE ? OR c.category_name LIKE ?)";
      const wildcard = `%${search.trim()}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    // Sorting
    const allowedSortColumns = ['created_at', 'due_date', 'priority', 'title', 'position'];
    const activeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'position';
    const sortOrder = order === 'DESC' ? 'DESC' : 'ASC';

    if (activeSortBy === 'priority') {
      // High (1), Medium (2), Low (3)
      sql += ` ORDER BY CASE t.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END ${sortOrder}, t.id ASC`;
    } else if (activeSortBy === 'title') {
      sql += ` ORDER BY LOWER(t.title) ${sortOrder}, t.id ASC`;
    } else {
      sql += ` ORDER BY t.${activeSortBy} ${sortOrder}, t.id ASC`;
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ error: 'Internal server error fetching tasks.' });
  }
};

// GET /tasks - Get list of tasks
router.get('/', getTasks);

// GET /tasks/search - Search tasks (compatibility endpoint)
router.get('/search', getTasks);

// GET /tasks/filter - Filter tasks (compatibility endpoint)
router.get('/filter', getTasks);

// GET /tasks/:id - Get a specific task
router.get('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT t.*, c.category_name FROM tasks t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ? AND t.user_id = ?',
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Fetch task error:', error);
    res.status(500).json({ error: 'Internal server error fetching task.' });
  }
});

// POST /tasks - Create a task
router.post('/', validateTask, async (req, res) => {
  const userId = req.user.id;
  const { title, description, category_id, priority, due_date } = req.body;

  try {
    // 1. Calculate next position
    const [posRows] = await db.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = ?', [userId]);
    const position = posRows[0].next_pos || 1;

    // 2. Insert task
    const [result] = await db.query(
      'INSERT INTO tasks (user_id, title, description, category_id, priority, due_date, position, status) VALUES (?, ?, ?, ?, ?, ?, ?, "Pending")',
      [userId, title.trim(), description ? description.trim() : null, category_id || null, priority || 'Medium', due_date, position]
    );

    // Log Activity
    await logActivity(userId, title.trim(), 'Created Task');

    res.status(201).json({
      message: 'Task created successfully.',
      task: {
        id: result.insertId,
        title: title.trim(),
        description,
        category_id,
        priority,
        due_date,
        position,
        status: 'Pending'
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error creating task.' });
  }
});

// PUT /tasks/reorder - Update positions of multiple tasks (Drag & Drop)
router.put('/reorder', async (req, res) => {
  const userId = req.user.id;
  const { orders } = req.body; // Expects array of { id, position }

  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ error: 'Invalid order payloads.' });
  }

  try {
    // Execute updates. Since SQLite or MySQL can do it sequentially,
    // we use standard loops inside a transaction or sequential queries.
    for (const item of orders) {
      await db.query(
        'UPDATE tasks SET position = ? WHERE id = ? AND user_id = ?',
        [item.position, item.id, userId]
      );
    }

    await logActivity(userId, 'Multiple Tasks', 'Reordered Tasks');
    res.json({ message: 'Task order updated successfully.' });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: 'Internal server error updating task order.' });
  }
});

// PUT /tasks/:id - Update task details or status
router.put('/:id', validateTask, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { title, description, category_id, priority, status, due_date } = req.body;

  try {
    // Check if task exists and check current status
    const [existing] = await db.query('SELECT status, title FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const currentStatus = existing[0].status;
    const taskTitle = existing[0].title;

    // Update
    const [result] = await db.query(
      'UPDATE tasks SET title = ?, description = ?, category_id = ?, priority = ?, status = ?, due_date = ? WHERE id = ? AND user_id = ?',
      [title.trim(), description ? description.trim() : null, category_id || null, priority || 'Medium', status || 'Pending', due_date, id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Log Activity based on status transition or update
    if (status && status !== currentStatus) {
      await logActivity(userId, title.trim(), status === 'Completed' ? 'Completed Task' : 'Reopened Task');
    } else {
      await logActivity(userId, title.trim(), 'Updated Task');
    }

    res.json({
      message: 'Task updated successfully.',
      task: {
        id: Number(id),
        title,
        description,
        category_id,
        priority,
        status,
        due_date
      }
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error updating task.' });
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // Get title first for logging
    const [existing] = await db.query('SELECT title FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const taskTitle = existing[0].title;

    const [result] = await db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await logActivity(userId, taskTitle, 'Deleted Task');

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error deleting task.' });
  }
});

module.exports = router;
