const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ message: 'Заполните поля' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: 'Username занят' });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({ name, username, password: hashed });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({ token, user: { _id: user._id, name: user.name, username: user.username, avatar: user.avatar } });

  } catch (err) {
    res.status(500).json({ message: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Неверные данные' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Неверные данные' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: { _id: user._id, name: user.name, username: user.username, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка входа' });
  }
});

router.delete('/delete', require('../middleware/auth'), async (req, res) => {
  try {
    const Message = require('../models/Message');
    await Message.deleteMany({ $or: [{ sender: req.user._id }, { receiver: req.user._id }] });
    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Аккаунт удалён' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка удаления' });
  }
});

module.exports = router;
