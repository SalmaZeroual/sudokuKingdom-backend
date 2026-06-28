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
const bugReportRoutes = require('./routes/bugReport');
const adminRoutes = require('./routes/admin'); // ✅ NOUVEAU : dashboard admin
const publicRoutes = require('./routes/public'); // ✅ NOUVEAU : install tracking + annonce


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
// ✅ Bug corrigé : sur Flutter Web (Chrome), toute requête envoyant un
// header "Authorization" (donc TOUT appel authentifié — Amis, Messages,
// Énigme, Duel, etc.) déclenche un préflight CORS (OPTIONS) côté navigateur.
// Login/Inscription n'envoient PAS ce header et passaient donc sans
// problème, ce qui faisait croire à une simple coupure réseau alors que
// c'était le préflight qui échouait silencieusement.
// On configure maintenant CORS explicitement (origine, méthodes, et surtout
// le header Authorization), et on place cors() AVANT helmet() pour que le
// préflight soit traité avant toute autre règle de sécurité.
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ✅ crossOriginResourcePolicy par défaut ('same-origin') peut bloquer les
// réponses pour un client web servi sur une autre origine/port que l'API.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes); 
app.use('/api/game', gameRoutes);
app.use('/api/duel', duelRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/support', bugReportRoutes);
app.use('/api/admin', adminRoutes); // ✅ NOUVEAU
app.use('/api/public', publicRoutes); // ✅ NOUVEAU

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

// ✅ Bug corrigé : avant, le serveur commençait à accepter les requêtes
// IMMÉDIATEMENT, et le seed des 50 chapitres Énigme (une grosse série
// d'insertions SQLite) tournait EN MÊME TEMPS en arrière-plan. Si une
// requête (ex: /story/kingdoms) arrivait pendant ce court instant, elle
// pouvait être ralentie par la contention sur la base SQLite jusqu'à
// dépasser le délai d'attente côté app — qui affichait alors "Pas de
// connexion" alors que le serveur tournait très bien.
// On exécute maintenant le seed AVANT de commencer à écouter les requêtes.
async function startServer() {
  console.log('🌱 Vérification des chapitres Énigme...');
  try {
    const { ensureChaptersSeeded } = require('./controllers/storyController');
    await ensureChaptersSeeded();
  } catch (err) {
    console.error('❌ Erreur lors du seed automatique des chapitres Énigme:', err);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`✅ User profile routes enabled at /api/user`);
  });
}

startServer();

module.exports = { app, io };