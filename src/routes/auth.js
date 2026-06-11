const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { validateRegister } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// TEMPORARY DB SETUP ROUTE - WILL BE REMOVED AFTER RUNNING
router.get('/temp-setup-db', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    
    // 1. Delete all data from all tables in dependency order
    await db.query('DELETE FROM checklist_items');
    await db.query('DELETE FROM task_updates');
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM activity_logs');
    await db.query('DELETE FROM notes');
    await db.query('DELETE FROM tasks');
    await db.query('DELETE FROM categories');
    await db.query('DELETE FROM users');
    
    // 2. Create the admin user
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await db.query(
      'INSERT INTO users (username, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@example.com', hashedPassword, 'Administrator', 'Admin']
    );

    // 3. Seed Default Categories
    const categoriesList = ['Personal', 'Academic', 'Work', 'Health', 'Others'];
    for (const cat of categoriesList) {
      await db.query(
        "INSERT INTO categories (category_name) VALUES (?)",
        [cat]
      );
    }
    
    res.json({ success: true, message: 'Database wiped and single admin user created successfully!' });
  } catch (err) {
    console.error('Temp setup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /register
router.post('/register', validateRegister, async (req, res) => {
  const { username, email, password, name, role } = req.body;

  try {
    // Check if email already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email is already registered. Please log in or use a different email.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'User';
    const fullName = name || username;

    // Save user
    await db.query(
      'INSERT INTO users (username, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, fullName, userRole]
    );

    res.status(201).json({ message: 'Registration successful! You can now log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during registration.' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Retrieve user strictly by username
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token including name and role
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role },
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

module.exports = router;
