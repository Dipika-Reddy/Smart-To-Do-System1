const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Helper: Check task access permissions
async function verifyTaskAccess(taskId, userId, userRole) {
  const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (tasks.length === 0) return null;
  const task = tasks[0];
  if (userRole === 'Admin') return task;
  if (task.user_id === userId || task.assigned_to === userId) return task;
  return null;
}

// Helper to log activities
async function logActivity(userId, action, entityType, entityId) {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [userId, action, entityType, entityId]
    );
  } catch (err) {
    console.error('Failed to log checklist activity:', err);
  }
}

// GET /api/checklists/tasks/:taskId - Fetch items for a task
router.get('/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const task = await verifyTaskAccess(taskId, req.user.id, req.user.role);
  if (!task) {
    return res.status(403).json({ error: 'Access denied or task not found.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM checklist_items WHERE task_id = ? ORDER BY is_completed ASC, completed_at ASC, id ASC',
      [taskId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch checklist items error:', error);
    res.status(500).json({ error: 'Internal server error fetching checklist.' });
  }
});

// POST /api/checklists/tasks/:taskId - Create checklist item
router.post('/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Checklist item title is required.' });
  }

  const task = await verifyTaskAccess(taskId, req.user.id, req.user.role);
  if (!task) {
    return res.status(403).json({ error: 'Access denied or task not found.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO checklist_items (task_id, title, is_completed) VALUES (?, ?, 0)',
      [taskId, title.trim()]
    );
    await logActivity(req.user.id, `Added checklist item: "${title.trim()}"`, 'Checklist', result.insertId);
    res.status(201).json({
      id: result.insertId,
      task_id: Number(taskId),
      title: title.trim(),
      is_completed: 0,
      completed_at: null
    });
  } catch (error) {
    console.error('Create checklist item error:', error);
    res.status(500).json({ error: 'Internal server error creating checklist item.' });
  }
});

// PUT /api/checklists/:itemId - Update checklist item (toggle check or rename)
router.put('/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const { title, is_completed } = req.body;

  try {
    const [items] = await db.query('SELECT * FROM checklist_items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found.' });
    }
    const item = items[0];

    const task = await verifyTaskAccess(item.task_id, req.user.id, req.user.role);
    if (!task) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const nextTitle = title !== undefined ? title.trim() : item.title;
    const nextCompleted = is_completed !== undefined ? (is_completed ? 1 : 0) : item.is_completed;
    const completedAt = nextCompleted && !item.is_completed ? new Date().toISOString() : (nextCompleted ? item.completed_at : null);

    await db.query(
      'UPDATE checklist_items SET title = ?, is_completed = ?, completed_at = ? WHERE id = ?',
      [nextTitle, nextCompleted, completedAt, itemId]
    );

    // Log Activity and trigger update on tasks table position/percentage if needed
    await logActivity(
      req.user.id,
      `Updated checklist item: "${nextTitle}" (${nextCompleted ? 'Completed' : 'Pending'})`,
      'Checklist',
      itemId
    );

    // Dynamic Recalculation of task completion percentage
    const [allChecklists] = await db.query('SELECT * FROM checklist_items WHERE task_id = ?', [item.task_id]);
    const totalCount = allChecklists.length;
    const completedCount = allChecklists.filter(i => i.is_completed).length;
    const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (task.status === 'Completed' ? 100 : 0);

    await db.query('UPDATE tasks SET completion_percentage = ? WHERE id = ?', [completionPercent, item.task_id]);

    res.json({
      id: Number(itemId),
      task_id: item.task_id,
      title: nextTitle,
      is_completed: nextCompleted,
      completed_at: completedAt,
      completion_percentage: completionPercent
    });
  } catch (error) {
    console.error('Update checklist item error:', error);
    res.status(500).json({ error: 'Internal server error updating checklist item.' });
  }
});

// DELETE /api/checklists/:itemId - Delete checklist item
router.delete('/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const [items] = await db.query('SELECT * FROM checklist_items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found.' });
    }
    const item = items[0];

    const task = await verifyTaskAccess(item.task_id, req.user.id, req.user.role);
    if (!task) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await db.query('DELETE FROM checklist_items WHERE id = ?', [itemId]);
    await logActivity(req.user.id, `Deleted checklist item: "${item.title}"`, 'Checklist', itemId);

    // Recalculate task percentage
    const [allChecklists] = await db.query('SELECT * FROM checklist_items WHERE task_id = ?', [item.task_id]);
    const totalCount = allChecklists.length;
    const completedCount = allChecklists.filter(i => i.is_completed).length;
    const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (task.status === 'Completed' ? 100 : 0);

    await db.query('UPDATE tasks SET completion_percentage = ? WHERE id = ?', [completionPercent, item.task_id]);

    res.json({ message: 'Checklist item deleted.', completion_percentage: completionPercent });
  } catch (error) {
    console.error('Delete checklist item error:', error);
    res.status(500).json({ error: 'Internal server error deleting checklist item.' });
  }
});

module.exports = router;
