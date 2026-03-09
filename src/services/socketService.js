const Duel = require('../models/Duel');
const User = require('../models/User');
const { generateSudoku } = require('./sudokuGenerator');

let io;
const waitingPlayers = new Map(); // difficulty -> [players]
const activeDuels = new Map(); // duelId -> socket info

// ✅ NOUVEAU : Gestion de la présence des utilisateurs
const onlineUsers = new Map(); // userId -> socketId

// ==========================================
// BOT SIMULATION
// ==========================================
const BOT_USER = {
  userId: 999,
  username: 'amitest',
  socketId: 'bot-socket-id',
};

function simulateBotPlay(duelId, solution, playerSocketId) {
  let progress = 0;
  let mistakes = 0;
  
  console.log(`🤖 Bot started playing in duel ${duelId}`);
  
  const botInterval = setInterval(() => {
    if (!activeDuels.has(duelId)) {
      clearInterval(botInterval);
      console.log(`🤖 Bot stopped - duel ${duelId} no longer active`);
      return;
    }
    
    const increment = Math.floor(Math.random() * 11) + 5;
    progress = Math.min(100, progress + increment);
    
    if (Math.random() < 0.15 && mistakes < 2) {
      mistakes++;
      console.log(`🤖 Bot made a mistake! (${mistakes}/3)`);
    }
    
    Duel.updateProgress(duelId, BOT_USER.userId, progress, mistakes)
      .catch(err => console.error('Bot progress update error:', err));
    
    io.to(playerSocketId).emit('opponent_progress', { 
      progress, 
      mistakes 
    });
    
    console.log(`🤖 Bot progress: ${progress}% (${mistakes} mistakes)`);
    
    if (mistakes >= 3) {
      clearInterval(botInterval);
      io.to(playerSocketId).emit('opponent_eliminated');
      Duel.complete(duelId, duelId.player1Id)
        .catch(err => console.error('Bot elimination completion error:', err));
      activeDuels.delete(duelId);
      console.log(`💀 Bot eliminated by 3 mistakes in duel ${duelId}`);
      return;
    }
    
    if (progress >= 95) {
      clearInterval(botInterval);
      console.log(`🤖 Bot approaching completion at ${progress}%...`);
      setTimeout(() => {
        if (activeDuels.has(duelId)) {
          console.log(`🤖 Bot finished! Player should win by being faster.`);
        }
      }, 5000);
    }
    
  }, 4000);
}

// ==========================================
// ✅ HELPER: Broadcaster le statut online des amis
// ==========================================
function broadcastFriendsStatus(userId) {
  // Envoyer à tous les utilisateurs en ligne le statut de leurs amis
  io.emit('friends_status_update');
}

// ==========================================
// SOCKET SERVICE
// ==========================================

exports.initializeSocket = (socketIo) => {
  io = socketIo;
  
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);
    
    // ==========================================
    // ✅ PRÉSENCE UTILISATEUR
    // ==========================================
    
    socket.on('user_online', async (userId) => {
      try {
        console.log(`👤 User ${userId} is now ONLINE`);
        
        // Stocker le socket de l'utilisateur
        onlineUsers.set(userId, socket.id);
        
        // Broadcaster aux amis que cet utilisateur est en ligne
        broadcastFriendsStatus(userId);
        
      } catch (error) {
        console.error('Error handling user_online:', error);
      }
    });
    
    socket.on('user_offline', async (userId) => {
      try {
        console.log(`👤 User ${userId} is now OFFLINE`);
        
        // Retirer de la liste des utilisateurs en ligne
        onlineUsers.delete(userId);
        
        // Broadcaster aux amis que cet utilisateur est hors ligne
        broadcastFriendsStatus(userId);
        
      } catch (error) {
        console.error('Error handling user_offline:', error);
      }
    });
    
    // ✅ Vérifier si un utilisateur est en ligne
    socket.on('check_user_status', ({ userId }, callback) => {
      const isOnline = onlineUsers.has(userId);
      callback({ isOnline });
    });
    
    // ✅ Vérifier le statut de plusieurs utilisateurs (liste d'amis)
    socket.on('check_friends_status', ({ friendIds }, callback) => {
      const statuses = {};
      friendIds.forEach(friendId => {
        statuses[friendId] = onlineUsers.has(friendId);
      });
      callback(statuses);
    });
    
    // ==========================================
    // MATCHMAKING
    // ==========================================
    
    socket.on('search_duel', async ({ difficulty, userId }) => {
      try {
        console.log(`🔍 User ${userId} searching for ${difficulty} duel`);
        
        if (!waitingPlayers.has(difficulty)) {
          waitingPlayers.set(difficulty, []);
        }
        
        const waiting = waitingPlayers.get(difficulty);
        
        if (waiting.length > 0) {
          const opponent = waiting.shift();
          
          console.log(`🎮 Real player match found! ${userId} vs ${opponent.userId}`);
          
          const { grid, solution } = generateSudoku(difficulty);
          const result = await Duel.create(opponent.userId, userId, grid, solution, difficulty);
          const duel = await Duel.findById(result.id);
          
          const player1 = await User.findById(opponent.userId);
          const player2 = await User.findById(userId);
          
          const duelData = {
            id: duel.id,
            player1_id: duel.player1_id,
            player2_id: duel.player2_id,
            player1_name: player1.username,
            player2_name: player2.username,
            grid: duel.grid,
            solution: duel.solution,
            difficulty: duel.difficulty,
            status: duel.status,
            player1_progress: 0,
            player2_progress: 0,
            player1_mistakes: 0,
            player2_mistakes: 0,
            created_at: duel.created_at,
          };
          
          activeDuels.set(duel.id, {
            player1Socket: opponent.socketId,
            player2Socket: socket.id,
            player1Id: opponent.userId,
            player2Id: userId,
          });
          
          io.to(opponent.socketId).emit('duel_found', duelData);
          io.to(socket.id).emit('duel_found', duelData);
          
          console.log(`✅ Real player duel ${duel.id} created between ${opponent.userId} and ${userId}`);
          
        } else {
          console.log(`🤖 No players waiting, creating BOT match for user ${userId}`);
          
          const { grid, solution } = generateSudoku(difficulty);
          const player = await User.findById(userId);
          
          if (!player) {
            console.error(`❌ User ${userId} not found`);
            socket.emit('error', { message: 'User not found' });
            return;
          }
          
          const result = await Duel.create(userId, BOT_USER.userId, grid, solution, difficulty);
          const duel = await Duel.findById(result.id);
          
          const duelData = {
            id: duel.id,
            player1_id: duel.player1_id,
            player2_id: duel.player2_id,
            player1_name: player.username,
            player2_name: BOT_USER.username,
            grid: duel.grid,
            solution: duel.solution,
            difficulty: duel.difficulty,
            status: 'active',
            player1_progress: 0,
            player2_progress: 0,
            player1_mistakes: 0,
            player2_mistakes: 0,
            created_at: duel.created_at,
          };
          
          activeDuels.set(duel.id, {
            player1Socket: socket.id,
            player2Socket: BOT_USER.socketId,
            player1Id: userId,
            player2Id: BOT_USER.userId,
          });
          
          io.to(socket.id).emit('duel_found', duelData);
          
          console.log(`✅ Bot duel ${duel.id} created: ${player.username} vs ${BOT_USER.username}`);
          
          simulateBotPlay(duel.id, duel.solution, socket.id);
        }
        
      } catch (error) {
        console.error('Search duel error:', error);
        socket.emit('error', { message: 'Failed to search for opponent' });
      }
    });
    
    socket.on('cancel_search', ({ difficulty, userId }) => {
      if (waitingPlayers.has(difficulty)) {
        const waiting = waitingPlayers.get(difficulty);
        const index = waiting.findIndex(p => p.userId === userId);
        
        if (index !== -1) {
          waiting.splice(index, 1);
          console.log(`❌ User ${userId} cancelled search`);
        }
      }
    });
    
    // ==========================================
    // GAMEPLAY
    // ==========================================
    
    socket.on('update_progress', async ({ duel_id, progress, mistakes }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        
        const duel = await Duel.findById(duel_id);
        const playerId = isPlayer1 ? duel.player1_id : duel.player2_id;
        
        await Duel.updateProgress(duel_id, playerId, progress, mistakes || 0);
        
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('opponent_progress', { 
            progress, 
            mistakes: mistakes || 0 
          });
        }
        
        console.log(`📊 Progress updated for duel ${duel_id}: ${progress}% (${mistakes} mistakes)`);
        
      } catch (error) {
        console.error('Update progress error:', error);
      }
    });
    
    socket.on('duel_completed', async ({ duel_id }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        const winnerId = isPlayer1 ? duelInfo.player1Id : duelInfo.player2Id;
        
        await Duel.complete(duel_id, winnerId);
        
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('duel_finished', { 
            winner_id: isPlayer1 ? 'player1' : 'player2' 
          });
        }
        
        activeDuels.delete(duel_id);
        
        console.log(`🏆 Duel ${duel_id} completed - Winner: ${winnerId}`);
        
      } catch (error) {
        console.error('Duel completed error:', error);
      }
    });
    
    socket.on('player_eliminated', async ({ duel_id }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        const winnerId = isPlayer1 ? duelInfo.player2Id : duelInfo.player1Id;
        
        await Duel.complete(duel_id, winnerId);
        
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('opponent_eliminated');
        }
        
        activeDuels.delete(duel_id);
        
        console.log(`⚠️ Player eliminated in duel ${duel_id} - Winner: ${winnerId}`);
        
      } catch (error) {
        console.error('Player elimination error:', error);
      }
    });
    
    socket.on('abandon_duel', async ({ duel_id }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        const winnerId = isPlayer1 ? duelInfo.player2Id : duelInfo.player1Id;
        
        await Duel.complete(duel_id, winnerId);
        
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('opponent_disconnected');
        }
        
        activeDuels.delete(duel_id);
        
        console.log(`🏃 Player abandoned duel ${duel_id} - Winner by default: ${winnerId}`);
        
      } catch (error) {
        console.error('Abandon duel error:', error);
      }
    });
    
    // ==========================================
    // IN-GAME MESSAGES
    // ==========================================
    
    socket.on('duel_message', ({ duel_id, sender_id, content }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('duel_message', { 
            sender_id,
            content 
          });
        } else {
          const botMessages = [
            '👍 Bien joué !',
            '😎 Continue comme ça',
            '🔥 Tu es en feu !',
            '💪 Fort !',
            '⚡ Rapide !',
          ];
          
          setTimeout(() => {
            const randomMsg = botMessages[Math.floor(Math.random() * botMessages.length)];
            io.to(socket.id).emit('duel_message', {
              sender_id: BOT_USER.userId,
              content: randomMsg,
            });
            console.log(`🤖 Bot replied: "${randomMsg}"`);
          }, 1500);
        }
        
        console.log(`💬 Message sent in duel ${duel_id}: "${content}"`);
        
      } catch (error) {
        console.error('Duel message error:', error);
      }
    });
    
    // ==========================================
    // DISCONNECT HANDLING
    // ==========================================
    
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      
      // ✅ Retirer de la liste des utilisateurs en ligne
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          console.log(`👤 User ${userId} went OFFLINE (disconnect)`);
          broadcastFriendsStatus(userId);
          break;
        }
      }
      
      for (const [difficulty, waiting] of waitingPlayers.entries()) {
        const index = waiting.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          waiting.splice(index, 1);
          console.log(`🗑️ Removed from ${difficulty} waiting list`);
        }
      }
      
      for (const [duelId, duelInfo] of activeDuels.entries()) {
        if (duelInfo.player1Socket === socket.id || duelInfo.player2Socket === socket.id) {
          const opponentSocket = duelInfo.player1Socket === socket.id 
            ? duelInfo.player2Socket 
            : duelInfo.player1Socket;
          
          const winnerId = duelInfo.player1Socket === socket.id
            ? duelInfo.player2Id
            : duelInfo.player1Id;
          
          Duel.complete(duelId, winnerId).catch(err => {
            console.error('Error completing duel on disconnect:', err);
          });
          
          if (opponentSocket !== BOT_USER.socketId) {
            io.to(opponentSocket).emit('opponent_disconnected');
          }
          
          activeDuels.delete(duelId);
          
          console.log(`🔌 Duel ${duelId} ended due to disconnect - Winner: ${winnerId}`);
        }
      }
    });
  });
};

// ✅ NOUVEAU : Fonction pour vérifier si un utilisateur est en ligne
exports.isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// ✅ NOUVEAU : Fonction pour récupérer tous les utilisateurs en ligne
exports.getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

exports.getIo = () => io;