const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Поиск только по username
router.get('/search/:username', auth, async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).select('-password');
    if (!user) return res.status(404).json({ message: 'Не найден' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: 'Ошибка' }); }
});

module.exports = router;
