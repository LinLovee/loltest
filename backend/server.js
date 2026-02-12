import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import { authenticateSocket } from './middleware/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  },
  maxHttpBufferSize: 100 * 1024 * 1024 // 100MB for file uploads
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io connection
const onlineUsers = new Map();
const typingUsers = new Map();

io.use(authenticateSocket);

io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${userId}`);
  
  // Add user to online users
  onlineUsers.set(userId, socket.id);
  io.emit('user_online', { userId, online: true });

  // Join user's personal room
  socket.join(`user:${userId}`);

  // Handle sending messages
  socket.on('send_message', async (data) => {
    const { receiverId, text, messageType, messageData } = data;
    
    // Broadcast to receiver if online
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('new_message', {
        senderId: userId,
        text,
        messageType: messageType || 'text',
        messageData,
        timestamp: new Date().toISOString()
      });
      
      // Update conversations list for receiver
      io.to(receiverSocketId).emit('conversation_updated', {
        userId,
        lastMessage: text,
        lastMessageType: messageType || 'text',
        timestamp: new Date().toISOString()
      });
    }
    
    // Also send back to sender for confirmation and update their conversation list
    socket.emit('message_sent', {
      receiverId,
      text,
      messageType: messageType || 'text',
      messageData,
      timestamp: new Date().toISOString()
    });
    
    socket.emit('conversation_updated', {
      userId: receiverId,
      lastMessage: text,
      lastMessageType: messageType || 'text',
      timestamp: new Date().toISOString()
    });
  });

  // Handle message editing
  socket.on('edit_message', (data) => {
    const { messageId, text, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message_edited', {
        messageId,
        text,
        senderId: userId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle message deletion
  socket.on('delete_message', (data) => {
    const { messageId, receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message_deleted', {
        messageId,
        senderId: userId
      });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { userId });
      
      // Clear previous timeout
      if (typingUsers.has(`${userId}-${receiverId}`)) {
        clearTimeout(typingUsers.get(`${userId}-${receiverId}`));
      }
      
      // Auto-stop typing after 3 seconds
      const timeout = setTimeout(() => {
        io.to(receiverSocketId).emit('user_stop_typing', { userId });
        typingUsers.delete(`${userId}-${receiverId}`);
      }, 3000);
      
      typingUsers.set(`${userId}-${receiverId}`, timeout);
    }
  });

  socket.on('stop_typing', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_stop_typing', { userId });
      
      // Clear timeout
      const key = `${userId}-${receiverId}`;
      if (typingUsers.has(key)) {
        clearTimeout(typingUsers.get(key));
        typingUsers.delete(key);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
    onlineUsers.delete(userId);
    io.emit('user_online', { userId, online: false });
    
    // Clear all typing indicators for this user
    for (const [key, timeout] of typingUsers.entries()) {
      if (key.startsWith(`${userId}-`)) {
        clearTimeout(timeout);
        typingUsers.delete(key);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
