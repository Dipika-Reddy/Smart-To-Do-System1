const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { validateRegister, rateLimiter } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /register
router.post('/register', rateLimiter, validateRegister, async (req, res) => {
  const { employee_id, username, email, password, name, role } = req.body;
  const userRole = role || 'User';
  const dbEmployeeId = userRole === 'Admin' ? null : (employee_id || username);
  const dbUsername = username;

  try {
    // Check if email already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email is already registered. Please log in or use a different email.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = name || dbUsername;

    // Save user
    const [result] = await db.query(
      'INSERT INTO users (employee_id, username, email, password, name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [dbEmployeeId, dbUsername, email, hashedPassword, fullName, userRole]
    );

    res.status(201).json({ 
      message: 'Registration successful! You can now log in.',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during registration.' });
  }
});

// POST /login
router.post('/login', rateLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Employee ID/Username and password are required.' });
  }

  try {
    const input = username.trim();

    // Look up by employee_id or username
    const [users] = await db.query(
      "SELECT * FROM users WHERE employee_id = ? OR username = ?",
      [input, input]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid Employee ID/Username or password.' });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid Employee ID/Username or password.' });
    }

    // Generate JWT token including name and role
    const token = jwt.sign(
      { id: user.id, employee_id: user.employee_id, username: user.username, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        employee_id: user.employee_id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during login.' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully.' });
});

// GET /me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// PUT /change-password
router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    // Password rules check
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }
    const hasUppercase = /[A-Z]/.test(newPassword);
    if (!hasUppercase) {
      return res.status(400).json({ error: 'New password must contain at least one uppercase letter.' });
    }
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasNumber) {
      return res.status(400).json({ error: 'New password must contain at least one number.' });
    }
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-\[\]\\\/]/.test(newPassword);
    if (!hasSpecial) {
      return res.status(400).json({ error: 'New password must contain at least one special character.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error changing password.' });
  }
});

// POST /reset-password
router.post('/reset-password', rateLimiter, async (req, res) => {
  const { username, email, newPassword } = req.body;
  if (!username || !email || !newPassword) {
    return res.status(400).json({ error: 'Username/Employee ID, email, and new password are required.' });
  }

  try {
    const input = username.trim();
    const targetEmail = email.trim().toLowerCase();

    // Look up by (employee_id or username) AND email
    const [users] = await db.query(
      "SELECT * FROM users WHERE (LOWER(employee_id) = LOWER(?) OR LOWER(username) = LOWER(?)) AND LOWER(email) = LOWER(?)",
      [input, input, targetEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User/Admin with this Employee ID/Username and Email does not exist.' });
    }

    // Password rules check
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }
    const hasUppercase = /[A-Z]/.test(newPassword);
    if (!hasUppercase) {
      return res.status(400).json({ error: 'New password must contain at least one uppercase letter.' });
    }
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasNumber) {
      return res.status(400).json({ error: 'New password must contain at least one number.' });
    }
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-\[\]\\\/]/.test(newPassword);
    if (!hasSpecial) {
      return res.status(400).json({ error: 'New password must contain at least one special character.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = users[0];
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message || 'Internal server error resetting password.' });
  }
});

// POST /crm-login — Auto login from CRM session
router.post('/crm-login', async (req, res) => {
  const { empId, name, role } = req.body;

  if (!empId || !name) {
    return res.status(400).json({ error: 'Missing employee info.' });
  }

  try {
    const email = `${empId.toLowerCase()}@hps.internal`;
    const employee_id = empId.toLowerCase();

    // Find or create user
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    let userId;
    let todoRole = 'User'; // Default to User role for safety

    if (existing.length > 0) {
      userId = existing[0].id;
      todoRole = existing[0].role; // Keep the existing role to prevent escalation
      
      // Update name only
      await db.query(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, userId]
      );
    } else {
      const bcrypt = require('bcryptjs');
      const dummyPassword = await bcrypt.hash(empId + '_hps', 10);
      const [result] = await db.query(
        'INSERT INTO users (employee_id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
        [employee_id, email, dummyPassword, name, todoRole]
      );
      userId = result.insertId;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: userId, employee_id, username: employee_id, email, name, role: todoRole },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',  // important for cross-origin iframe
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Auto login successful.', user: { id: userId, employee_id, username: employee_id, name, role: todoRole } });
  } catch (error) {
    console.error('CRM login error:', error);
    res.status(500).json({ error: 'Auto login failed.' });
  }
});
module.exports = router;
