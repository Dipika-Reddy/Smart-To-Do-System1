const { Pool } = require('pg');
require('dotenv').config();

let dbType = 'postgresql';
let pgPool = null;
let initError = null;

// Unified query function to be exported
let query = async (sql, params = []) => {
  if (initError) {
    throw new Error('Database initialization failed: ' + initError.message);
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
    const err = new Error('Database connection URL is missing. Please set SUPABASE_DB_URL or DATABASE_URL in your environment variables.');
    initError = err;
    console.error('Fatal: ' + err.message);
    throw err;
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
