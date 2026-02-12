const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Message = require('../models/Message');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// отправить текстовое сообщение и сохранить в БД
router.post('/send', auth, async (req, res) => {
  try {
    const { receiver, text, type } = req.body;
    const message = await Message.create({ sender: req.user._id, receiver, text, type: type || 'text' });

    // emit via socket
    const io = req.app.get('io');
    io.to(receiver).emit('receive_message', message);

    res.json(message);
  } catch (err) { res.status(500).json({ message: 'Ошибка отправки' }); }
});

// отправить файл (image/video/file/voice)
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { receiver } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Нет файла' });

    const mimetype = file.mimetype;
    const type = mimetype.startsWith('image') ? 'image' : mimetype.startsWith('video') ? 'video' : mimetype.startsWith('audio') ? 'voice' : 'file';

    const message = await Message.create({
      sender: req.user._id,
      receiver,
      file: file.filename,
      type
    });

    // emit via socket
    const io = req.app.get('io');
    io.to(receiver).emit('receive_message', message);

    res.json(message);
  } catch (err) { res.status(500).json({ message: 'Ошибка загрузки' }); }
});

// получить историю с пользователем
router.get('/history/:userId', auth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const msgs = await Message.find({ $or: [
      { sender: req.user._id, receiver: otherId },
      { sender: otherId, receiver: req.user._id }
    ] }).sort({ createdAt: 1 });

    res.json(msgs);
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
});

// редактировать сообщение
router.put('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const { text } = req.body;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Не найдено' });
    if (String(msg.sender) !== String(req.user._id)) return res.status(403).json({ message: 'Нет прав' });

    msg.text = text;
    msg.edited = true;
    msg.editedAt = new Date();
    await msg.save();

    const io = req.app.get('io');
    io.to(msg.receiver).emit('message_edited', msg);

    res.json(msg);
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
});

// удалить сообщение
router.delete('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Не найдено' });
    if (String(msg.sender) !== String(req.user._id)) return res.status(403).json({ message: 'Нет прав' });

    await Message.findByIdAndDelete(id);

    const io = req.app.get('io');
    io.to(msg.receiver).emit('message_deleted', { id, receiver: msg.receiver, sender: msg.sender });

    res.json({ message: 'Удалено' });
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
});

module.exports = router;
