const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all EOD routes
router.use(authenticateToken);

// Helper to notify admins
async function notifyAdminsOfSubmission(userId, username, fullName, reportDate) {
  try {
    const [admins] = await db.query("SELECT id FROM users WHERE role = 'Admin'");
    const displayName = fullName || username;
    for (const admin of admins) {
      if (admin.id === userId) continue; // Don't notify self if Admin submits
      await db.query(
        'INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)',
        [
          admin.id,
          'EOD Status Submitted',
          `${displayName} submitted EOD report for ${reportDate}.`
        ]
      );
    }
  } catch (err) {
    console.error('Notify admins of EOD error:', err);
  }
}

// GET /api/eod/today - Fetch current user's EOD report for a specific date
router.get('/today', async (req, res) => {
  const userId = req.user.id;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM eod_reports WHERE user_id = ? AND report_date = ?',
      [userId, date]
    );

    if (rows.length === 0) {
      return res.json({});
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Fetch today EOD error:', error);
    res.status(500).json({ error: 'Internal server error fetching EOD report.' });
  }
});

// GET /api/eod/suggestions - Get task titles completed or in-progress for prepopulating
router.get('/suggestions', async (req, res) => {
  const userId = req.user.id;

  try {
    const [tasks] = await db.query(
      'SELECT title, status FROM tasks WHERE user_id = ? OR assigned_to = ?',
      [userId, userId]
    );

    const completed = tasks.filter(t => t.status === 'Completed').map(t => t.title);
    const inProgress = tasks.filter(t => t.status === 'In Progress').map(t => t.title);

    res.json({ completed, inProgress });
  } catch (error) {
    console.error('Fetch EOD suggestions error:', error);
    res.status(500).json({ error: 'Internal server error loading suggestions.' });
  }
});

// POST /api/eod - Save or update an EOD report
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { report_date, summary, tasks_completed, tasks_in_progress, blockers } = req.body;

  if (!report_date || !summary || !summary.trim()) {
    return res.status(400).json({ error: 'Report date and day summary are required.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM eod_reports WHERE user_id = ? AND report_date = ?',
      [userId, report_date]
    );

    if (existing.length > 0) {
      // Update
      await db.query(
        `UPDATE eod_reports 
         SET summary = ?, tasks_completed = ?, tasks_in_progress = ?, blockers = ? 
         WHERE user_id = ? AND report_date = ?`,
        [
          summary.trim(), 
          tasks_completed ? tasks_completed.trim() : null, 
          tasks_in_progress ? tasks_in_progress.trim() : null, 
          blockers ? blockers.trim() : null, 
          userId, 
          report_date
        ]
      );
    } else {
      // Insert
      await db.query(
        `INSERT INTO eod_reports (user_id, report_date, summary, tasks_completed, tasks_in_progress, blockers) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          report_date,
          summary.trim(),
          tasks_completed ? tasks_completed.trim() : null,
          tasks_in_progress ? tasks_in_progress.trim() : null,
          blockers ? blockers.trim() : null
        ]
      );
    }

    // Trigger notification to admins
    await notifyAdminsOfSubmission(userId, req.user.username, req.user.name, report_date);

    res.status(existing.length > 0 ? 200 : 201).json({ 
      message: existing.length > 0 ? 'EOD report updated successfully.' : 'EOD report submitted successfully.' 
    });
  } catch (error) {
    console.error('Save EOD report error:', error);
    res.status(500).json({ error: 'Internal server error saving EOD report.' });
  }
});

// GET /api/eod/history - Fetch user's personal EOD submission history
router.get('/history', async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      'SELECT * FROM eod_reports WHERE user_id = ? ORDER BY report_date DESC LIMIT 50',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch EOD history error:', error);
    res.status(500).json({ error: 'Internal server error fetching EOD history.' });
  }
});

// GET /api/eod/all - Retrieve EOD reports for all users (Admin only)
router.get('/all', authorizeRoles('Admin'), async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT r.*, u.username, u.name 
       FROM eod_reports r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.report_date = ? 
       ORDER BY u.name ASC, u.username ASC`,
      [date]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch all EOD reports error:', error);
    res.status(500).json({ error: 'Internal server error retrieving team reports.' });
  }
});

module.exports = router;
