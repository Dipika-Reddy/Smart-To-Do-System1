const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all category routes
router.use(authenticateToken);

// GET /categories - Get all categories
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const userRole = (req.user.role || '').trim().toLowerCase();
  
  try {
    let sql = 'SELECT * FROM categories';
    const params = [];
    if (userRole !== 'admin') {
      sql += ' WHERE user_id IS NULL OR user_id = ?';
      params.push(userId);
    }
    sql += ' ORDER BY category_name ASC';
    
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Internal server error fetching categories.' });
  }
});

// POST /categories - Create a new category
router.post('/', async (req, res) => {
  const { category_name } = req.body;
  const userId = req.user.id;
  const userRole = (req.user.role || '').trim().toLowerCase();
  const dbUserId = userRole === 'admin' ? null : userId;

  if (!category_name || !category_name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    // Check if duplicate for the current scope (global or owned by user)
    let checkSql = 'SELECT * FROM categories WHERE category_name = ? AND (user_id IS NULL OR user_id = ?)';
    const checkParams = [category_name.trim(), userId];
    const [existing] = await db.query(checkSql, checkParams);
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category already exists.' });
    }

    const [result] = await db.query(
      'INSERT INTO categories (category_name, user_id) VALUES (?, ?)',
      [category_name.trim(), dbUserId]
    );

    res.status(201).json({
      message: 'Category created successfully.',
      category: {
        id: result.insertId,
        category_name: category_name.trim(),
        user_id: dbUserId
      }
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error creating category.' });
  }
});

// PUT /categories/:id - Update an existing category
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { category_name } = req.body;
  const userId = req.user.id;
  const userRole = (req.user.role || '').trim().toLowerCase();

  if (!category_name || !category_name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const [existingCat] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existingCat.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (userRole !== 'admin') {
      if (existingCat[0].user_id !== userId) {
        return res.status(403).json({ error: 'Access denied. You cannot modify this category.' });
      }
    }

    // Check if duplicate
    const [existing] = await db.query(
      'SELECT * FROM categories WHERE category_name = ? AND id != ? AND (user_id IS NULL OR user_id = ?)',
      [category_name.trim(), id, userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Another category with this name already exists.' });
    }

    const [result] = await db.query(
      'UPDATE categories SET category_name = ? WHERE id = ?',
      [category_name.trim(), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({
      message: 'Category updated successfully.',
      category: {
        id: Number(id),
        category_name: category_name.trim(),
        user_id: existingCat[0].user_id
      }
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error updating category.' });
  }
});

// DELETE /categories/:id - Delete a category
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = (req.user.role || '').trim().toLowerCase();

  try {
    const [existingCat] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existingCat.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (userRole !== 'admin') {
      if (existingCat[0].user_id !== userId) {
        return res.status(403).json({ error: 'Access denied. You cannot delete this category.' });
      }
    }

    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error deleting category.' });
  }
});

module.exports = router;
