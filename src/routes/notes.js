const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth to all note routes
router.use(authenticateToken);

const VALID_COLORS = ['default', 'yellow', 'blue', 'green', 'pink', 'purple', 'gray'];

// GET /api/notes - Get all notes for the logged-in user
router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json(rows);
  } catch (error) {
    console.error('Fetch notes error:', error);
    res.status(500).json({ error: 'Internal server error fetching notes.' });
  }
});

const VALID_PATTERNS = ['blank', 'lined', 'grid', 'dots', 'diagonal', 'gradient'];

// POST /api/notes - Create a new note or list
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { title, content, type, color_theme, pattern_theme } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Note title cannot be empty.' });
  }

  const noteType = type === 'List' ? 'List' : 'Note';
  const color = VALID_COLORS.includes(color_theme) ? color_theme : 'default';
  const pattern = VALID_PATTERNS.includes(pattern_theme) ? pattern_theme : 'blank';
  const noteContent = content ? content.trim() : '';

  try {
    const [result] = await db.query(
      'INSERT INTO notes (user_id, title, content, type, color_theme, pattern_theme) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title.trim(), noteContent, noteType, color, pattern]
    );

    res.status(201).json({
      message: 'Note created successfully.',
      note: {
        id: result.insertId,
        title: title.trim(),
        content: noteContent,
        type: noteType,
        color_theme: color,
        pattern_theme: pattern,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error creating note.' });
  }
});

// PUT /api/notes/:id - Update an existing note or list
router.put('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { title, content, type, color_theme, pattern_theme } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Note title cannot be empty.' });
  }

  const noteType = type === 'List' ? 'List' : 'Note';
  const color = VALID_COLORS.includes(color_theme) ? color_theme : 'default';
  const pattern = VALID_PATTERNS.includes(pattern_theme) ? pattern_theme : 'blank';
  const noteContent = content ? content.trim() : '';

  try {
    const [result] = await db.query(
      'UPDATE notes SET title = ?, content = ?, type = ?, color_theme = ?, pattern_theme = ? WHERE id = ? AND user_id = ?',
      [title.trim(), noteContent, noteType, color, pattern, id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({
      message: 'Note updated successfully.',
      note: {
        id: Number(id),
        title: title.trim(),
        content: noteContent,
        type: noteType,
        color_theme: color,
        pattern_theme: pattern
      }
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error updating note.' });
  }
});

// DELETE /api/notes/:id - Delete a note or list
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({ message: 'Note deleted successfully.' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error deleting note.' });
  }
});

module.exports = router;
