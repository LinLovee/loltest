import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  const currentUserId = req.userId;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email, avatar_url 
       FROM users 
       WHERE username ILIKE $1 AND id != $2
       LIMIT 20`,
      [`%${q}%`, currentUserId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (for demo purposes)
router.get('/', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;

  try {
    const result = await pool.query(
      `SELECT id, username, email, avatar_url 
       FROM users 
       WHERE id != $1
       ORDER BY username
       LIMIT 50`,
      [currentUserId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
