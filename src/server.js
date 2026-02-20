const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user'); // ✅ NOUVEAU
const gameRoutes = require('./routes/game');
const duelRoutes = require('./routes/duel');
const tournamentRoutes = require('./routes/tournament');
const socialRoutes = require('./routes/social');
const chatRoutes = require('./routes/chat');
const storyRoutes = require('./routes/story');

const { initializeSocket } = require('./services/socketService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes); // ✅ NOUVEAU - User profile routes
app.use('/api/game', gameRoutes);
app.use('/api/duel', duelRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/story', storyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Socket.io
initializeSocket(io);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`✅ User profile routes enabled at /api/user`); // ✅ NOUVEAU
});

module.exports = { app, io };