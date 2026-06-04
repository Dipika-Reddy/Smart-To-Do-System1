const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./config/database');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const categoryRoutes = require('./routes/categories');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS Protections (Security requirement)
app.use((req, res, next) => {
  const allowedOrigins = [process.env.CORS_ORIGIN || 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/notes', notesRoutes);

// Fallback to SPA Frontend for clean browser history navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database then start server
db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(` Smart To-Do List Management System Server Running`);
      console.log(` Port:    http://localhost:${PORT}`);
      console.log(` Mode:    ${process.env.NODE_ENV || 'development'}`);
      console.log(` DB:      ${db.getDbType().toUpperCase()}`);
      console.log(`=================================================`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Failed to initialize database on server start.', err);
    process.exit(1);
  });
