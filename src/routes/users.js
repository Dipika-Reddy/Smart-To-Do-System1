const express = require('express');
const db = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/users - Get all users (ID, name, username, email, role)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, employee_id, username, email, name, role, created_at FROM users ORDER BY username ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Internal server error fetching users.' });
  }
});

// DELETE /api/users/:id - Delete a user (Admin only)
router.delete('/:id', authorizeRoles('Admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error deleting user.' });
  }
});

module.exports = router;
