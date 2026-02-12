require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

// make io available in routes
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// socket
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('send_message', (msg) => {
    io.to(msg.receiver).emit('receive_message', msg);
  });

  socket.on('typing', ({from, to}) => {
    io.to(to).emit('typing', { from });
  });

  socket.on('stop_typing', ({from, to}) => {
    io.to(to).emit('stop_typing', { from });
  });

  socket.on('message_edited', (msg) => {
    io.to(msg.receiver).emit('message_edited', msg);
  });

  socket.on('message_deleted', (info) => {
    io.to(info.receiver).emit('message_deleted', info);
  });

  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    server.listen(PORT, () => console.log('Backend listening on', PORT));
  })
  .catch(err => console.error(err));
