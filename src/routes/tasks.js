const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateTask, sanitizeHtml } = require('../middleware/validation');

const router = express.Router();

// Apply auth to all task routes
router.use(authenticateToken);

// Auto-progress mapping by status
function getAutoProgress(status) {
  switch (status) {
    case 'Pending': return 0;
    case 'In Progress': return 25;
    case 'Review': return 75;
    case 'Completed': return 100;
    default: return 0;
  }
}

// Helper to log activities
async function logActivity(userId, action, entityType, entityId) {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [userId, action, entityType, entityId]
    );
  } catch (err) {
    console.error('Log activity error:', err);
  }
}

// Helper to create notification
async function createNotification(userId, title, message) {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)',
      [userId, title, message]
    );
  } catch (err) {
    console.error('Create notification error:', err);
  }
}

// GET /tasks/activities - Get activity logs for current user or all if Admin
router.get('/activities', async (req, res) => {
  try {
    let sql = `
      SELECT a.*, u.username,
             COALESCE(t1.title, t2.title) AS task_title
      FROM activity_logs a 
      LEFT JOIN users u ON a.user_id = u.id 
      LEFT JOIN tasks t1 ON a.entity_type = 'Task' AND a.entity_id = t1.id
      LEFT JOIN checklist_items ci ON a.entity_type = 'Checklist' AND a.entity_id = ci.id
      LEFT JOIN tasks t2 ON ci.task_id = t2.id
    `;
    const params = [];

    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole !== 'admin') {
      sql += `
        WHERE a.user_id = ? 
           OR (a.entity_type = 'Task' AND (t1.assigned_to = ? OR t1.user_id = ?))
           OR (a.entity_type = 'Checklist' AND (t2.assigned_to = ? OR t2.user_id = ?))
      `;
      params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    }
    
    sql += ' ORDER BY a.created_at DESC LIMIT 50';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch activities error:', error);
    res.status(500).json({ error: 'Internal server error fetching activities.' });
  }
});

// Common handler for fetching tasks to share between GET /tasks, GET /tasks/search, and GET /tasks/filter
const getTasks = async (req, res) => {
  const userId = req.user.id;
  const { status, category_id, priority, search, sortBy, order, assigned_to } = req.query;

  try {
    let sql = `
      SELECT t.*, c.category_name,
             u1.username AS creator_name,
             u2.username AS assignee_name
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE 1=1
    `;
    const params = [];

    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole !== 'admin') {
      sql += " AND (t.user_id = ? OR t.assigned_to = ?)";
      params.push(userId, userId);
    } else {
      if (assigned_to) {
        sql += " AND t.assigned_to = ?";
        params.push(Number(assigned_to));
      }
    }

    // Filters
    if (status) {
      sql += " AND t.status = ?";
      params.push(status);
    }
    if (category_id) {
      sql += " AND t.category_id = ?";
      params.push(Number(category_id));
    }
    if (priority) {
      sql += " AND t.priority = ?";
      params.push(priority);
    }

    // Search
    if (search && search.trim()) {
      sql += " AND (t.title LIKE ? OR t.description LIKE ? OR c.category_name LIKE ? OR u2.username LIKE ?)";
      const wildcard = `%${search.trim()}%`;
      params.push(wildcard, wildcard, wildcard, wildcard);
    }

    // Sorting
    const allowedSortColumns = ['created_at', 'due_date', 'priority', 'title', 'position'];
    const activeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'position';
    const sortOrder = order === 'DESC' ? 'DESC' : 'ASC';

    if (activeSortBy === 'priority') {
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
router.get('/search', getTasks);
router.get('/filter', getTasks);

// GET /tasks/:id - Get a specific task
router.get('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT t.*, c.category_name,
              u1.username AS creator_name,
              u2.username AS assignee_name
       FROM tasks t 
       LEFT JOIN categories c ON t.category_id = c.id 
       LEFT JOIN users u1 ON t.user_id = u1.id
       LEFT JOIN users u2 ON t.assigned_to = u2.id
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = rows[0];
    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole !== 'admin' && task.user_id !== userId && task.assigned_to !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json(task);
  } catch (error) {
    console.error('Fetch task error:', error);
    res.status(500).json({ error: 'Internal server error fetching task.' });
  }
});

// POST /tasks - Create a task (Admin only)
router.post('/', authorizeRoles('Admin'), validateTask, async (req, res) => {
  const userId = req.user.id;
  const { title, description, category_id, priority, due_date, assigned_to } = req.body;

  try {
    // 1. Calculate next position
    const [posRows] = await db.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = ?', [userId]);
    const position = posRows[0].next_pos || 1;

    // Default assignee (Self if not Admin, or selected user)
    const userRole = (req.user.role || '').trim().toLowerCase();
    const assignee = userRole === 'admin' ? (assigned_to ? Number(assigned_to) : null) : userId;

    // 2. Insert task
    const [result] = await db.query(
      `INSERT INTO tasks (
        user_id, title, description, category_id, priority, due_date, position, status, assigned_by, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      [
        userId, 
        title.trim(), 
        description ? description.trim() : null, 
        category_id ? Number(category_id) : null, 
        priority || 'Medium', 
        due_date, 
        position, 
        userId, 
        assignee
      ]
    );

    // Log Activity
    await logActivity(userId, `Created Task: "${title.trim()}"`, 'Task', result.insertId);

    // Send assignment notification
    if (assignee && assignee !== userId) {
      await createNotification(
        assignee,
        'New Task Assigned',
        `Admin assigned task: "${title.trim()}" to you. Due date: ${new Date(due_date).toLocaleString()}.`
      );
    }

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
        status: 'Pending',
        assigned_to: assignee
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
  const { orders } = req.body; // Expects array of { id, position, status }

  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ error: 'Invalid order payloads.' });
  }

  for (const item of orders) {
    if (!item.id || isNaN(Number(item.id))) {
      return res.status(400).json({ error: 'Invalid task ID in order payloads.' });
    }
    if (item.position === undefined || isNaN(Number(item.position))) {
      return res.status(400).json({ error: 'Invalid position in order payloads.' });
    }
    if (item.status && !['Pending', 'In Progress', 'Review', 'Completed'].includes(item.status)) {
      return res.status(400).json({ error: 'Invalid status in order payloads.' });
    }
  }

  try {
    for (const item of orders) {
      if (item.status) {
        // Drag-and-Drop Column change check
        const [existing] = await db.query('SELECT status, title, assigned_to, user_id FROM tasks WHERE id = ?', [item.id]);
        if (existing.length > 0) {
          const task = existing[0];
          // User protection boundary check
          const userRole = (req.user.role || '').trim().toLowerCase();
          if (userRole !== 'admin' && task.user_id !== userId && task.assigned_to !== userId) {
            continue; // Skip tasks they don't own
          }

          // If status changes, log activity and notify
          if (task.status !== item.status) {
            // Check workflow permissions: Admin can do anything. User can move items but review approval goes through Admin
            const userRole = (req.user.role || '').trim().toLowerCase();
            if (userRole !== 'admin' && item.status === 'Completed') {
              // Standard users cannot move tasks directly to Completed, map to Review
              item.status = 'Review';
            }

            const autoProgress = getAutoProgress(item.status);
            await db.query(
              'UPDATE tasks SET position = ?, status = ?, completion_percentage = ?, last_updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [item.position, item.status, autoProgress, userId, item.id]
            );

            await logActivity(userId, `Moved Task: "${task.title}" to ${item.status}`, 'Task', item.id);
            
            // Notify creator/assignee
            if (item.status === 'Review' && task.user_id !== userId) {
              await createNotification(
                task.user_id,
                'Task Ready for Review',
                `User completed work on: "${task.title}" and submitted for review.`
              );
            }
          } else {
            await db.query(
              'UPDATE tasks SET position = ? WHERE id = ?',
              [item.position, item.id]
            );
          }
        }
      } else {
        await db.query(
          'UPDATE tasks SET position = ? WHERE id = ?',
          [item.position, item.id]
        );
      }
    }

    res.json({ message: 'Task order updated successfully.' });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: 'Internal server error updating task order.' });
  }
});

// PUT /tasks/:id - Update task details, status, or assignee
router.put('/:id', validateTask, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { title, description, category_id, priority, status, due_date, assigned_to, completion_percentage, completion_notes } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = existing[0];
    const isOwner = task.user_id === userId;
    const isAssignee = task.assigned_to === userId;
    const userRole = (req.user.role || '').trim().toLowerCase();
    const isAdmin = userRole === 'admin';

    if (!isAdmin && !isOwner && !isAssignee) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (!isAdmin && status === 'Completed') {
      return res.status(403).json({ error: 'Only administrators can approve reviewed tasks or mark tasks as completed.' });
    }

    // Role restrictions: If standard user editing task created by admin, block structural changes
    if (!isAdmin && task.user_id !== userId) {
      // User can only modify progress percentage, status, and completion_notes
      const nextStatus = status || task.status;
      const finalStatus = (nextStatus === 'Completed' && task.user_id !== userId) ? 'Review' : nextStatus;

      await db.query(
        `UPDATE tasks SET 
          status = ?, 
          completion_percentage = ?, 
          completion_notes = ?, 
          last_updated_by = ?,
          updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [
          finalStatus, 
          completion_percentage !== undefined ? Number(completion_percentage) : task.completion_percentage,
          completion_notes !== undefined ? completion_notes.trim() : task.completion_notes,
          userId, 
          id
        ]
      );

      await logActivity(userId, `Updated progress on Task: "${task.title}" to ${finalStatus}`, 'Task', id);

      // Notification to admin
      if (finalStatus === 'Review' && task.status !== 'Review') {
        await createNotification(
          task.user_id,
          'Task Review Request',
          `Task "${task.title}" has been submitted for review by the assignee.`
        );
      }

      return res.json({ message: 'Task progress updated successfully.' });
    }

    // Full edit (Admin or Owner)
    const nextAssignee = assigned_to !== undefined ? (assigned_to ? Number(assigned_to) : null) : task.assigned_to;
    const nextStatus = status || task.status;

    await db.query(
      `UPDATE tasks SET 
        title = ?, 
        description = ?, 
        category_id = ?, 
        priority = ?, 
        status = ?, 
        due_date = ?, 
        assigned_to = ?, 
        completion_percentage = ?,
        completion_notes = ?,
        last_updated_by = ?,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        title.trim(),
        description ? description.trim() : null,
        category_id ? Number(category_id) : null,
        priority || 'Medium',
        nextStatus,
        due_date,
        nextAssignee,
        completion_percentage !== undefined ? Number(completion_percentage) : task.completion_percentage,
        completion_notes !== undefined ? completion_notes.trim() : task.completion_notes,
        userId,
        id
      ]
    );

    if (nextAssignee !== task.assigned_to && nextAssignee) {
      await createNotification(
        nextAssignee,
        'Task Assignment Reassigned',
        `You have been assigned to task: "${title.trim()}". Due date: ${new Date(due_date).toLocaleString()}.`
      );
    } else if (isAdmin && task.assigned_to && nextAssignee === task.assigned_to) {
      // Notify assignee if Admin updated task details
      if (
        title.trim() !== task.title ||
        (description && description.trim() !== task.description) ||
        (category_id && Number(category_id) !== task.category_id) ||
        priority !== task.priority ||
        due_date !== task.due_date
      ) {
        await createNotification(
          task.assigned_to,
          'Task Details Updated by Admin',
          `Admin updated details for your assigned task: "${title.trim()}"`
        );
      }
    }

    await logActivity(userId, `Modified Task details: "${title.trim()}"`, 'Task', id);

    res.json({ message: 'Task updated successfully.' });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error updating task.' });
  }
});

// PUT /tasks/:id/review - Review approval/rejection flow (Admin only)
router.put('/:id/review', authorizeRoles('Admin'), async (req, res) => {
  const { id } = req.params;
  const { action, comments } = req.body; // action: 'approve' | 'reject'

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action parameter must be "approve" or "reject".' });
  }

  try {
    const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = tasks[0];
    const nextStatus = action === 'approve' ? 'Completed' : 'In Progress';

    await db.query(
      `UPDATE tasks SET 
        status = ?, 
        review_comments = ?, 
        approved_by = ?, 
        approved_at = ?, 
        completion_percentage = ?,
        last_updated_by = ?,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        nextStatus, 
        comments ? comments.trim() : null, 
        req.user.id, 
        action === 'approve' ? new Date().toISOString() : null,
        action === 'approve' ? 100 : task.completion_percentage,
        req.user.id, 
        id
      ]
    );

    // Save history update log
    await db.query(
      'INSERT INTO task_updates (task_id, user_id, status, comment, progress_percentage) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, nextStatus, comments || `Admin reviewed task: ${action}`, action === 'approve' ? 100 : task.completion_percentage]
    );

    await logActivity(req.user.id, `Reviewed task: "${task.title}" (${action === 'approve' ? 'Approved' : 'Rejected'})`, 'Task', id);

    // Notify assignee
    if (task.assigned_to) {
      await createNotification(
        task.assigned_to,
        action === 'approve' ? 'Task Approved' : 'Task Revision Requested',
        action === 'approve' 
          ? `Admin approved your work on "${task.title}"!`
          : `Admin requested revisions for "${task.title}". Comments: "${comments || 'None'}"`
      );
    }

    res.json({ message: `Task review finalized as: ${nextStatus}.` });
  } catch (error) {
    console.error('Finalize task review error:', error);
    res.status(500).json({ error: 'Internal server error processing review.' });
  }
});

// GET /tasks/:id/updates - Get comment timeline / updates for a task
router.get('/:id/updates', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [taskRows] = await db.query('SELECT user_id, assigned_to FROM tasks WHERE id = ?', [id]);
    if (taskRows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    const task = taskRows[0];
    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole !== 'admin' && task.user_id !== userId && task.assigned_to !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const [rows] = await db.query(
      `SELECT tu.*, u.username, u.name 
       FROM task_updates tu 
       LEFT JOIN users u ON tu.user_id = u.id 
       WHERE tu.task_id = ? 
       ORDER BY tu.created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch task updates error:', error);
    res.status(500).json({ error: 'Internal server error fetching updates.' });
  }
});

// POST /tasks/:id/updates - Add comment / progress note to a task
router.post('/:id/updates', async (req, res) => {
  const { id } = req.params;
  const { comment, progress_percentage, status } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment content is required.' });
  }

  try {
    const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = tasks[0];
    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole !== 'admin' && task.user_id !== req.user.id && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Sanitize and validate inputs
    const cleanComment = sanitizeHtml(comment.trim());
    const cleanStatus = status || task.status;
    const cleanProgress = progress_percentage !== undefined ? Number(progress_percentage) : task.completion_percentage;

    if (cleanProgress < 0 || cleanProgress > 100 || isNaN(cleanProgress)) {
      return res.status(400).json({ error: 'Progress percentage must be between 0 and 100.' });
    }
    if (status && !['Pending', 'In Progress', 'Review', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid task status.' });
    }

    await db.query(
      `INSERT INTO task_updates (task_id, user_id, status, comment, progress_percentage) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        id, 
        req.user.id, 
        cleanStatus, 
        cleanComment, 
        cleanProgress
      ]
    );

    // Notify other party (if assignee, notify creator; if creator, notify assignee)
    const notificationTarget = req.user.id === task.user_id ? task.assigned_to : task.user_id;
    if (notificationTarget) {
      await createNotification(
        notificationTarget,
        'New Comment on Task',
        `${req.user.name || req.user.username} left a comment on "${task.title}": "${comment.trim()}"`
      );
    }

    res.status(201).json({ message: 'Progress update added.' });
  } catch (error) {
    console.error('Post progress update error:', error);
    res.status(500).json({ error: 'Internal server error adding update.' });
  }
});

// DELETE /tasks/:id - Delete a task (Admin, creator, or assignee)
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [existing] = await db.query('SELECT title, user_id, assigned_to FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = existing[0];
    const userRole = (req.user.role || '').trim().toLowerCase();
    const isAdmin = userRole === 'admin';
    const isOwner = task.user_id === userId;
    const isAssignee = task.assigned_to === userId;

    if (!isAdmin && !isOwner && !isAssignee) {
      return res.status(403).json({ error: 'Access denied. You can only delete tasks you created or are assigned to.' });
    }

    // Explicitly clean up related records before deleting the task
    await db.query('DELETE FROM checklist_items WHERE task_id = ?', [id]);
    await db.query('DELETE FROM task_updates WHERE task_id = ?', [id]);

    await db.query('DELETE FROM tasks WHERE id = ?', [id]);
    await logActivity(userId, `Deleted Task: "${task.title}"`, 'Task', id);

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error deleting task.' });
  }
});

module.exports = router;
