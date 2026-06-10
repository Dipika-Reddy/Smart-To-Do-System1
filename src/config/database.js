const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbType = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;
let pgPool = null;
let initError = null;

// Unified query function to be exported
let query = async (sql, params = []) => {
  if (initError) {
    throw new Error('Database initialization failed: ' + initError.message);
  }
  throw new Error('Database not initialized');
};

async function initDatabase() {
  const useSupabase = process.env.SUPABASE_DB_URL;

  if (useSupabase) {
    try {
      console.log('Attempting to connect to Supabase PostgreSQL database...');
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });

      // Test connection
      const client = await pgPool.connect();
      console.log('Successfully connected to Supabase PostgreSQL database.');
      client.release();

      dbType = 'supabase';

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

      query = async (sql, params = []) => {
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
      return;
    } catch (error) {
      console.error('Supabase Connection failed. Error:', error.message);
      initError = error;
      throw error;
    }
  }

  const useMysql = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (useMysql) {
    try {
      console.log('Attempting to connect to MySQL database at:', process.env.DB_HOST);
      const mysql = require('mysql2/promise');
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      // Test connection
      const connection = await mysqlPool.getConnection();
      console.log('Successfully connected to MySQL database.');
      connection.release();

      dbType = 'mysql';
      query = async (sql, params = []) => {
        const [rows, fields] = await mysqlPool.query(sql, params);
        return [rows, fields];
      };
      return;
    } catch (error) {
      console.warn('MySQL Connection failed. Falling back to SQLite. Error:', error.message);
    }
  }

  // SQLite Fallback
  // SQLite cannot be used on Vercel Serverless because it relies on compiled C++ native binaries.
  if (process.env.VERCEL) {
    const err = new Error('SQLite database fallback is not supported in the Vercel Serverless environment. Please define SUPABASE_DB_URL in your Vercel Project Environment Variables.');
    initError = err;
    throw err;
  }

  console.log('Initializing SQLite fallback database...');
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, '../../todo.db');
  
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Could not connect to SQLite database', err);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
    }
  });

  // Enable foreign keys in SQLite
  sqliteDb.run('PRAGMA foreign_keys = ON');

  // 1. Check if we need to drop old tasks table for schema changes
  const checkUpgrade = () => {
    return new Promise((res) => {
      sqliteDb.all("PRAGMA table_info(tasks)", (err, columns) => {
        if (err || !columns || columns.length === 0) return res();
        const hasAssignedTo = columns.some(c => c.name === 'assigned_to');
        if (!hasAssignedTo) {
          console.log("Upgrading tasks database schema: dropping old tasks table...");
          sqliteDb.run("DROP TABLE IF EXISTS tasks", () => {
            sqliteDb.run("DROP TABLE IF EXISTS activity_logs", () => {
              res();
            });
          });
        } else {
          res();
        }
      });
    });
  };

  await checkUpgrade();

  // 2. Initialize SQLite tables if they do not exist
  await new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      // Users table
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT DEFAULT NULL,
        role TEXT CHECK(role IN ('Admin', 'User')) DEFAULT 'User',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
        // Add columns if they are missing
        sqliteDb.run(`ALTER TABLE users ADD COLUMN name TEXT DEFAULT NULL`, () => {});
        sqliteDb.run(`ALTER TABLE users ADD COLUMN role TEXT CHECK(role IN ('Admin', 'User')) DEFAULT 'User'`, () => {});
      });

      // Categories table
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_name TEXT UNIQUE NOT NULL,
        user_id INTEGER DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) return reject(err);
        sqliteDb.run(`ALTER TABLE categories ADD COLUMN user_id INTEGER DEFAULT NULL`, () => {});
      });

      // Create tasks table
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
      )`, (taskErr) => {
        if (taskErr) return reject(taskErr);
      });

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
      )`, (err) => { 
        if (err) return reject(err); 
        sqliteDb.run("ALTER TABLE notes ADD COLUMN pattern_theme TEXT DEFAULT 'blank'", () => {});
      });

      // Seed categories
      const categories = ['Personal', 'Academic', 'Work', 'Health', 'Others'];
      const stmt = sqliteDb.prepare("INSERT OR IGNORE INTO categories (category_name) VALUES (?)");
      for (const cat of categories) {
        stmt.run(cat);
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  dbType = 'sqlite';
  
  query = (sql, params = []) => {
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
          // Return standardized structure mimicking MySQL driver execution
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, null]);
        });
      }
    });
  };
}

module.exports = {
  initDatabase,
  getDbType: () => dbType,
  query: (sql, params) => query(sql, params)
};
