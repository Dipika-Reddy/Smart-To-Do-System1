const { Pool } = require('pg');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

let dbType = 'postgresql';
let pgPool = null;
let sqliteDb = null;
let initError = null;

async function createDatabaseBackup() {
  if (dbType !== 'sqlite') return;
  try {
    const dbPath = path.resolve(__dirname, '../../todo.db');
    const backupsDir = path.resolve(__dirname, '../../backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupsDir, `todo_checkpoint_${timestamp}.db`);
    
    // Copy the database file
    fs.copyFileSync(dbPath, backupPath);
    
    // Clean up old backups, keeping only the last 5
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('todo_checkpoint_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
      
    if (files.length > 5) {
      for (let i = 5; i < files.length; i++) {
        fs.unlinkSync(path.join(backupsDir, files[i].name));
      }
    }
  } catch (err) {
    console.error('Failed to create database rollback checkpoint:', err.message);
  }
}

// Unified query function to be exported
let query = async (sql, params = []) => {
  if (initError) {
    throw new Error('Database initialization failed: ' + initError.message);
  }

  if (dbType === 'sqlite') {
    return new Promise((resolve, reject) => {
      const isSelect = /^\s*(SELECT|PRAGMA|SHOW|EXPLAIN)/i.test(sql);
      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve([rows, null]);
        });
      } else {
        sqliteDb.run(sql, params, function(err) {
          if (err) return reject(err);
          createDatabaseBackup().catch(e => console.error('Backup error:', e));
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, null]);
        });
      }
    });
  }

  if (!pgPool) {
    throw new Error('Database not initialized');
  }
  
  let translatedSql = sql;
  let index = 1;
  translatedSql = sql.replace(/\?/g, () => `$${index++}`);

  const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
  if (isInsert && !/RETURNING/i.test(translatedSql)) {
    translatedSql += ' RETURNING id';
  }

  const res = await pgPool.query(translatedSql, params);

  if (isInsert) {
    let insertId = null;
    if (res.rows && res.rows.length > 0) {
      insertId = res.rows[0].id || res.rows[0].insertid;
    }
    return [{ insertId, affectedRows: res.rowCount }, null];
  } else {
    const isSelect = /^\s*(SELECT|SHOW|EXPLAIN)/i.test(sql);
    if (isSelect) {
      return [res.rows, null];
    } else {
      return [{ affectedRows: res.rowCount }, null];
    }
  }
};

async function initDatabase() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.warn('Database connection URL is missing. Activating zero-configuration SQLite database fallback...');
    if (process.env.VERCEL) {
      const err = new Error('SQLite database fallback is not supported in the Vercel Serverless environment. Please define SUPABASE_DB_URL.');
      initError = err;
      throw err;
    }

    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, '../../todo.db');
    
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Could not connect to SQLite database', err);
      } else {
        console.log('Connected to SQLite database at:', dbPath);
      }
    });

    sqliteDb.run('PRAGMA foreign_keys = ON');
    sqliteDb.run('PRAGMA journal_mode = WAL');
    sqliteDb.run('PRAGMA synchronous = NORMAL');

    await new Promise((resolve, reject) => {
      sqliteDb.serialize(() => {
        // Users table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id VARCHAR(50) DEFAULT NULL,
          username TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT DEFAULT NULL,
          role TEXT CHECK(role IN ('Admin', 'User')) DEFAULT 'User',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) reject(err); });

        // Migration: add employee_id column if it doesn't exist (for existing databases)
        sqliteDb.run(`ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) DEFAULT NULL`, () => {
          // Ignore error - column may already exist
        });

        // Categories table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_name TEXT UNIQUE NOT NULL,
          user_id INTEGER DEFAULT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`, (err) => { if (err) reject(err); });

        // Tasks table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          category_id INTEGER DEFAULT NULL,
          priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
          status TEXT CHECK(status IN ('Pending', 'In Progress', 'Review', 'Completed')) DEFAULT 'Pending',
          due_date DATETIME NOT NULL,
          assigned_by INTEGER DEFAULT NULL,
          assigned_to INTEGER DEFAULT NULL,
          completion_percentage INTEGER DEFAULT 0,
          review_comments TEXT,
          completion_notes TEXT,
          approved_by INTEGER DEFAULT NULL,
          approved_at DATETIME DEFAULT NULL,
          last_updated_by INTEGER DEFAULT NULL,
          position INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
          FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL,
          FOREIGN KEY (last_updated_by) REFERENCES users (id) ON DELETE SET NULL
        )`, (err) => { if (err) reject(err); });

        // Checklist Items table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS checklist_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          is_completed INTEGER DEFAULT 0,
          completed_at DATETIME DEFAULT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )`, (err) => { if (err) reject(err); });

        // Task Updates table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS task_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          status TEXT,
          comment TEXT,
          progress_percentage INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`, (err) => { if (err) reject(err); });

        // Notifications table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`, (err) => { if (err) reject(err); });

        // Activity Logs table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id INTEGER DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`, (err) => { if (err) reject(err); });

        // Notes table
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT CHECK(type IN ('Note', 'List')) DEFAULT 'Note',
          color_theme TEXT DEFAULT 'default',
          pattern_theme TEXT DEFAULT 'blank',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`, (err) => { if (err) reject(err); });

        // Seed categories
        const categories = ['Personal', 'Academic', 'Work', 'Health', 'Others'];
        const stmt = sqliteDb.prepare("INSERT OR IGNORE INTO categories (category_name) VALUES (?)");
        for (const cat of categories) {
          stmt.run(cat);
        }
        stmt.finalize((err) => {
          if (err) return reject(err);
          const bcrypt = require('bcryptjs');
          bcrypt.hash('Admin@123', 10, (hashErr, hashedPassword) => {
            if (hashErr) return reject(hashErr);
            sqliteDb.run(
              "UPDATE users SET username = 'admin', employee_id = 'admin', password = ? WHERE role = 'Admin' OR username = 'VerifyAdmin'",
              [hashedPassword],
              (updateErr) => {
                if (updateErr) return reject(updateErr);
                createDatabaseBackup().catch(e => console.error('Startup backup error:', e));
                resolve();
              }
            );
          });
        });
      });
    });

    dbType = 'sqlite';
    return;
  }

  try {
    console.log('Attempting to connect to PostgreSQL database...');
    pgPool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Test connection
    const client = await pgPool.connect();
    console.log('Successfully connected to PostgreSQL database.');
    client.release();

    dbType = 'postgresql';

    // Initialize PostgreSQL tables if they do not exist
    await pgPool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      role VARCHAR(50) DEFAULT 'User' CHECK(role IN ('Admin', 'User')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      category_name VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE CASCADE
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category_id INTEGER DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL,
      priority VARCHAR(50) DEFAULT 'Medium' CHECK(priority IN ('High', 'Medium', 'Low')),
      status VARCHAR(50) DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Review', 'Completed')),
      due_date TIMESTAMP NOT NULL,
      assigned_by INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      assigned_to INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      completion_percentage INTEGER DEFAULT 0,
      review_comments TEXT,
      completion_notes TEXT,
      approved_by INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMP DEFAULT NULL,
      last_updated_by INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS checklist_items (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      is_completed INTEGER DEFAULT 0,
      completed_at TIMESTAMP DEFAULT NULL
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS task_updates (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(255),
      comment TEXT,
      progress_percentage INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      entity_type VARCHAR(255) NOT NULL,
      entity_id INTEGER DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'Note' CHECK(type IN ('Note', 'List')),
      color_theme VARCHAR(50) DEFAULT 'default',
      pattern_theme VARCHAR(50) DEFAULT 'blank',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed categories
    const categories = ['Personal', 'Academic', 'Work', 'Health', 'Others'];
    for (const cat of categories) {
      await pgPool.query(
        "INSERT INTO categories (category_name) VALUES ($1) ON CONFLICT (category_name) DO NOTHING",
        [cat]
      );
    }

    // Ensure VerifyAdmin's password is set to 'Admin@123'
    try {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      const res = await pgPool.query(
        "UPDATE users SET username = 'admin', employee_id = 'admin', password = $1 WHERE role = 'Admin' OR username = 'VerifyAdmin'",
        [hashedPassword]
      );
      console.log(`Updated admin user to username 'admin' and password 'Admin@123' in PostgreSQL/Supabase: ${res.rowCount} row(s) updated.`);
    } catch (passErr) {
      console.error('Failed to update admin credentials in PostgreSQL:', passErr.message);
    }
  } catch (error) {
    console.error('Database Connection failed. Error:', error.message);
    initError = error;
    throw error;
  }
}

module.exports = {
  initDatabase,
  getDbType: () => dbType,
  query: (sql, params) => query(sql, params)
};
