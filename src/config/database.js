const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbType = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;

// Unified query function to be exported
let query = async (sql, params = []) => {
  throw new Error('Database not initialized');
};

async function initDatabase() {
  const useMysql = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (useMysql) {
    try {
      console.log('Attempting to connect to MySQL database at:', process.env.DB_HOST);
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
  console.log('Initializing SQLite fallback database...');
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

  // Initialize SQLite tables if they do not exist
  await new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      // Users table
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) reject(err); });

      // Categories table
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_name TEXT UNIQUE NOT NULL
      )`, (err) => { if (err) reject(err); });

      // Tasks table
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category_id INTEGER DEFAULT NULL,
        priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
        status TEXT CHECK(status IN ('Pending', 'Completed')) DEFAULT 'Pending',
        due_date DATETIME NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
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
        sqliteDb.run("ALTER TABLE notes ADD COLUMN pattern_theme TEXT DEFAULT 'blank'", (alterErr) => {
          // Ignore error since it fails if the column already exists
        });
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
