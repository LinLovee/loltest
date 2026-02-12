import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get conversation with a user
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;
  const otherUserId = parseInt(req.params.userId);

  try {
    const result = await pool.query(
      `SELECT m.*, 
        sender.username as sender_username,
        receiver.username as receiver_username
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [currentUserId, otherUserId]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages 
       SET read = TRUE 
       WHERE receiver_id = $1 AND sender_id = $2 AND read = FALSE`,
      [currentUserId, otherUserId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/send', authenticateToken, async (req, res) => {
  const senderId = req.userId;
  const { receiverId, text } = req.body;

  if (!receiverId || !text || !text.trim()) {
    return res.status(400).json({ error: 'Receiver and message text are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, text) 
       VALUES ($1, $2, $3) 
       RETURNING id, sender_id, receiver_id, text, created_at, read`,
      [senderId, receiverId, text.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  const userId = req.userId;

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (other_user_id)
        other_user_id,
        other_username,
        last_message,
        last_message_time,
        unread_count
       FROM (
         SELECT 
           CASE 
             WHEN m.sender_id = $1 THEN m.receiver_id 
             ELSE m.sender_id 
           END as other_user_id,
           CASE 
             WHEN m.sender_id = $1 THEN receiver.username 
             ELSE sender.username 
           END as other_username,
           m.text as last_message,
           m.created_at as last_message_time,
           (SELECT COUNT(*) 
            FROM messages 
            WHERE sender_id = CASE 
              WHEN m.sender_id = $1 THEN m.receiver_id 
              ELSE m.sender_id 
            END
            AND receiver_id = $1 
            AND read = FALSE) as unread_count
         FROM messages m
         JOIN users sender ON m.sender_id = sender.id
         JOIN users receiver ON m.receiver_id = receiver.id
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.created_at DESC
       ) sub
       ORDER BY other_user_id, last_message_time DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
