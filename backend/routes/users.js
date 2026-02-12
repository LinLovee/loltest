import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users by username only
router.get('/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  const currentUserId = req.userId;

  if (!q || q.trim().length === 0) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url 
       FROM users 
       WHERE username ILIKE $1 AND id != $2
       LIMIT 20`,
      [`%${q}%`, currentUserId]
    );

    res.json(result.rows.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    })));
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
