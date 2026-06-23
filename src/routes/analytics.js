const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { parseNaiveToLocalDate } = require('../utils/dateFormatter');

const router = express.Router();

router.use(authenticateToken);

// Helper to check overdue counts
const calculateOverdueTasks = (tasksList) => {
  const now = new Date();
  return tasksList.filter(t => t.status !== 'Completed' && parseNaiveToLocalDate(t.due_date) < now).length;
};

// GET /api/analytics/dashboard - Fetch status aggregates & general dashboard data
router.get('/dashboard', async (req, res) => {
  const userId = req.user.id;
  const userRole = (req.user.role || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const scope = req.query.scope; // 'user' or 'all'

  try {
    let sql = 'SELECT * FROM tasks';
    const params = [];

    if (scope === 'user' || !isAdmin) {
      // Users only see tasks they created or tasks assigned to them
      sql += ' WHERE user_id = ? OR assigned_to = ?';
      params.push(userId, userId);
    }

    const [tasks] = await db.query(sql, params);

    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const review = tasks.filter(t => t.status === 'Review').length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const assigned = tasks.filter(t => t.assigned_to !== null && t.assigned_to !== t.user_id).length;
    
    // Calculate overdue (Pending/In Progress/Review and due date passed)
    const now = new Date();
    const overdue = tasks.filter(t => t.status !== 'Completed' && parseNaiveToLocalDate(t.due_date) < now).length;

    // Calculate Productivity Score: (completed / total) * 100
    const productivityScore = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      total,
      pending,
      inProgress,
      review,
      completed,
      overdue,
      assigned,
      productivityScore
    });
  } catch (error) {
    console.error('Fetch dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error aggregating statistics.' });
  }
});

// GET /api/analytics/performance - User performance tracking (Admin only)
router.get('/performance', authorizeRoles('Admin'), async (req, res) => {
  try {
    // Get all users
    const [users] = await db.query('SELECT id, name, username, email, role FROM users');
    
    // Get all tasks
    const [tasks] = await db.query('SELECT * FROM tasks');

    const performanceMetrics = users.map(user => {
      // Filter tasks assigned to this user
      const userTasks = tasks.filter(t => t.assigned_to === user.id);
      const totalAssigned = userTasks.length;
      const completed = userTasks.filter(t => t.status === 'Completed').length;
      const pending = userTasks.filter(t => t.status === 'Pending').length;
      const inProgress = userTasks.filter(t => t.status === 'In Progress').length;
      const review = userTasks.filter(t => t.status === 'Review').length;

      const now = new Date();
      const overdue = userTasks.filter(t => t.status !== 'Completed' && parseNaiveToLocalDate(t.due_date) < now).length;

      // Completion Rate
      const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

      // Average completion time (simplified, using difference between created_at and updated_at for Completed tasks)
      const completedTasks = userTasks.filter(t => t.status === 'Completed');
      let totalTimeHours = 0;
      completedTasks.forEach(t => {
        const start = new Date(t.created_at);
        const end = new Date(t.updated_at);
        totalTimeHours += Math.abs(end - start) / 36e5; // 36e5 is milliseconds in an hour
      });
      const averageCompletionTimeHours = completedTasks.length > 0 ? Math.round((totalTimeHours / completedTasks.length) * 10) / 10 : 0;

      return {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        role: user.role,
        totalAssigned,
        completed,
        pending: pending + inProgress + review,
        overdue,
        completionRate,
        averageCompletionTimeHours
      };
    });

    res.json(performanceMetrics);
  } catch (error) {
    console.error('Fetch user performance analytics error:', error);
    res.status(500).json({ error: 'Internal server error calculating performance metrics.' });
  }
});

// GET /api/analytics/distributions - Status and category charts datasets
router.get('/distributions', async (req, res) => {
  const userId = req.user.id;
  const userRole = (req.user.role || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const scope = req.query.scope; // 'user' or 'all'

  try {
    let tasksSql = `
      SELECT t.*, c.category_name 
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
    `;
    const params = [];

    if (scope === 'user' || !isAdmin) {
      tasksSql += ' WHERE t.user_id = ? OR t.assigned_to = ?';
      params.push(userId, userId);
    }

    const [tasks] = await db.query(tasksSql, params);

    // 1. Status Distribution
    const statuses = ['Pending', 'In Progress', 'Review', 'Completed'];
    const statusDistribution = statuses.map(status => ({
      name: status,
      value: tasks.filter(t => t.status === status).length
    }));

    // 2. Category Distribution
    const categoryMap = {};
    tasks.forEach(t => {
      const catName = t.category_name || 'Uncategorized';
      categoryMap[catName] = (categoryMap[catName] || 0) + 1;
    });
    const categoryDistribution = Object.keys(categoryMap).map(key => ({
      name: key,
      value: categoryMap[key]
    }));

    res.json({
      statusDistribution,
      categoryDistribution
    });
  } catch (error) {
    console.error('Fetch chart distributions error:', error);
    res.status(500).json({ error: 'Internal server error loading distribution charts.' });
  }
});

module.exports = router;
