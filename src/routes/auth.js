const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { validateRegister } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /register
router.post('/register', validateRegister, async (req, res) => {
  const { employee_id, username, email, password, name, role } = req.body;
  const finalEmpId = employee_id || username;

  try {
    // Check if email already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email is already registered. Please log in or use a different email.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'User';
    const fullName = name || finalEmpId;

    // Save user
    const [result] = await db.query(
      'INSERT INTO users (employee_id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      [finalEmpId, email, hashedPassword, fullName, userRole]
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
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Employee ID/Username and password are required.' });
  }

  try {
    const input = username.trim();
    // Default the role guess to 'User' if the input format looks like numeric or if explicitly provided
    const loginRole = role || ( /^\d+$/.test(input) ? 'User' : 'Admin' );

    // Look up by employee_id column
    const [users] = await db.query(
      'SELECT * FROM users WHERE employee_id = ?',
      [input]
    );

    if (users.length === 0) {
      const errorMsg = loginRole === 'User' ? 'Invalid Employee ID or password.' : 'Invalid username or password.';
      return res.status(400).json({ error: errorMsg });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const errorMsg = user.role === 'User' ? 'Invalid Employee ID or password.' : 'Invalid username or password.';
      return res.status(400).json({ error: errorMsg });
    }

    // Generate JWT token including name and role
    const token = jwt.sign(
      { id: user.id, employee_id: user.employee_id, username: user.employee_id, email: user.email, name: user.name, role: user.role },
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
        username: user.employee_id,
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

// POST /crm-login — Auto login from CRM session
router.post('/crm-login', async (req, res) => {
  const { empId, name, role } = req.body;

  if (!empId || !name) {
    return res.status(400).json({ error: 'Missing employee info.' });
  }

  try {
    const todoRole = role === 'admin' ? 'Admin' : 'User';
    const email = `${empId.toLowerCase()}@hps.internal`;
    const employee_id = empId.toLowerCase();

    // Find or create user
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    let userId;
    if (existing.length > 0) {
      userId = existing[0].id;
      // Update name/role in case it changed
      await db.query(
        'UPDATE users SET name = ?, role = ? WHERE id = ?',
        [name, todoRole, userId]
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
