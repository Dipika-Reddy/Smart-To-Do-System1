const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'smart_todo_super_secret_key_12345!';

const authenticateToken = (req, res, next) => {
  // Check token in cookie first, then in Authorization header
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in first.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, username, email
    next();
  } catch (error) {
    // If token is expired or altered
    res.clearCookie('token');
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

module.exports = {
  authenticateToken,
  JWT_SECRET
};
