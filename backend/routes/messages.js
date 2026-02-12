import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Serve uploaded files
router.use('/files', express.static('uploads'));

// Get conversation with a user
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;
  const otherUserId = parseInt(req.params.userId);

  try {
    const result = await pool.query(
      `SELECT m.*, 
        sender.username as sender_username,
        sender.display_name as sender_display_name,
        receiver.username as receiver_username,
        receiver.display_name as receiver_display_name
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE ((m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1))
          AND m.deleted = FALSE
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

// Send a text message
router.post('/send', authenticateToken, async (req, res) => {
  const senderId = req.userId;
  const { receiverId, text, messageType = 'text' } = req.body;

  if (!receiverId || (!text && messageType === 'text')) {
    return res.status(400).json({ error: 'Receiver and message text are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, text, message_type) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [senderId, receiverId, text?.trim() || '', messageType]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload and send file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const senderId = req.userId;
  const { receiverId, messageType, duration } = req.body;

  if (!receiverId || !req.file) {
    return res.status(400).json({ error: 'Receiver and file are required' });
  }

  try {
    const fileUrl = `/api/messages/files/${req.file.filename}`;
    
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message_type, file_url, file_name, file_size, duration, text) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [senderId, receiverId, messageType, fileUrl, req.file.originalname, req.file.size, duration || null, '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit message
router.put('/edit/:messageId', authenticateToken, async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body;
  const userId = req.userId;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE messages 
       SET text = $1, edited = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND sender_id = $3 AND deleted = FALSE AND message_type = 'text'
       RETURNING *`,
      [text.trim(), messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or cannot be edited' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete message
router.delete('/delete/:messageId', authenticateToken, async (req, res) => {
  const { messageId } = req.params;
  const userId = req.userId;

  try {
    const result = await pool.query(
      `UPDATE messages 
       SET deleted = TRUE, text = '', file_url = NULL
       WHERE id = $1 AND sender_id = $2 AND deleted = FALSE
       RETURNING *`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
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
        other_display_name,
        last_message,
        last_message_time,
        last_message_type,
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
           CASE 
             WHEN m.sender_id = $1 THEN receiver.display_name 
             ELSE sender.display_name 
           END as other_display_name,
           CASE
             WHEN m.deleted = TRUE THEN 'Сообщение удалено'
             WHEN m.message_type = 'text' THEN m.text
             WHEN m.message_type = 'image' THEN '📷 Фото'
             WHEN m.message_type = 'video' THEN '🎥 Видео'
             WHEN m.message_type = 'video_note' THEN '⭕ Видео-кружок'
             WHEN m.message_type = 'voice' THEN '🎤 Голосовое сообщение'
             WHEN m.message_type = 'file' THEN '📎 Файл'
             ELSE m.text
           END as last_message,
           m.message_type as last_message_type,
           m.created_at as last_message_time,
           (SELECT COUNT(*) 
            FROM messages 
            WHERE sender_id = CASE 
              WHEN m.sender_id = $1 THEN m.receiver_id 
              ELSE m.sender_id 
            END
            AND receiver_id = $1 
            AND read = FALSE
            AND deleted = FALSE) as unread_count
         FROM messages m
         JOIN users sender ON m.sender_id = sender.id
         JOIN users receiver ON m.receiver_id = receiver.id
         WHERE (m.sender_id = $1 OR m.receiver_id = $1)
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
