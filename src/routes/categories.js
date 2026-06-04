const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all category routes
router.use(authenticateToken);

// GET /categories - Get all categories
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY category_name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Internal server error fetching categories.' });
  }
});

// POST /categories - Create a new category
router.post('/', async (req, res) => {
  const { category_name } = req.body;

  if (!category_name || !category_name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    // Check if duplicate
    const [existing] = await db.query('SELECT * FROM categories WHERE category_name = ?', [category_name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category already exists.' });
    }

    const [result] = await db.query(
      'INSERT INTO categories (category_name) VALUES (?)',
      [category_name.trim()]
    );

    res.status(201).json({
      message: 'Category created successfully.',
      category: {
        id: result.insertId,
        category_name: category_name.trim()
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

  if (!category_name || !category_name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    // Check if duplicate
    const [existing] = await db.query(
      'SELECT * FROM categories WHERE category_name = ? AND id != ?',
      [category_name.trim(), id]
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
        category_name: category_name.trim()
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

  try {
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
