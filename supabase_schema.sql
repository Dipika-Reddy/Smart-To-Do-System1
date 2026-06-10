-- Smart To-Do List Management System Schema (PostgreSQL / Supabase)
-- Paste this script directly into your Supabase SQL Editor and run it.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  role VARCHAR(50) DEFAULT 'User' CHECK(role IN ('Admin', 'User')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
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
);

-- Index for searching and filtering performance on tasks
CREATE INDEX IF NOT EXISTS idx_user_tasks ON tasks(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_task_category ON tasks(category_id);

-- 4. Checklist Items Table
CREATE TABLE IF NOT EXISTS checklist_items (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_completed INTEGER DEFAULT 0,
  completed_at TIMESTAMP DEFAULT NULL
);

-- 5. Task Updates Table
CREATE TABLE IF NOT EXISTS task_updates (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(255),
  comment TEXT,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type VARCHAR(255) NOT NULL,
  entity_id INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'Note' CHECK(type IN ('Note', 'List')),
  color_theme VARCHAR(50) DEFAULT 'default',
  pattern_theme VARCHAR(50) DEFAULT 'blank',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_notes ON notes(user_id, created_at DESC);

-- Seed Default Categories
INSERT INTO categories (category_name) VALUES 
('Personal'),
('Academic'),
('Work'),
('Health'),
('Others')
ON CONFLICT (category_name) DO NOTHING;
