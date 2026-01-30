const Duel = require('../models/Duel');
const User = require('../models/User');
const { generateSudoku } = require('./sudokuGenerator');

let io;
const waitingPlayers = new Map(); // difficulty -> [players]
const activeDuels = new Map(); // duelId -> socket info

// ==========================================
// BOT SIMULATION - Pour tester seul
// ==========================================
const BOT_USER = {
  userId: 999,
  username: 'amitest',
  socketId: 'bot-socket-id',
};

// Simule un bot qui joue automatiquement
function simulateBotPlay(duelId, solution) {
  let progress = 0;
  let mistakes = 0;
  
  const botInterval = setInterval(() => {
    if (!activeDuels.has(duelId)) {
      clearInterval(botInterval);
      return;
    }
    
    const duelInfo = activeDuels.get(duelId);
    
    // Le bot fait des progrès aléatoires (10-20% par update)
    progress = Math.min(100, progress + Math.floor(Math.random() * 15) + 5);
    
    // Le bot fait parfois des erreurs (20% de chance)
    if (Math.random() < 0.2 && mistakes < 3) {
      mistakes++;
    }
    
    // Mettre à jour la base de données
    Duel.updateProgress(duelId, BOT_USER.userId, progress, mistakes)
      .catch(err => console.error('Bot progress update error:', err));
    
    // Envoyer la progression au joueur réel
    if (duelInfo.player1Socket) {
      io.to(duelInfo.player1Socket).emit('opponent_progress', { 
        progress, 
        mistakes 
      });
    }
    
    console.log(`🤖 Bot progress: ${progress}% (${mistakes} mistakes)`);
    
    // Le bot termine vers 95-100%
    if (progress >= 95) {
      clearInterval(botInterval);
      
      // Le bot a terminé ! (mais légèrement plus lent que le joueur)
      setTimeout(() => {
        if (activeDuels.has(duelId)) {
          const duelInfo = activeDuels.get(duelId);
          
          // Le joueur réel gagne si le bot termine
          if (duelInfo.player1Socket) {
            io.to(duelInfo.player1Socket).emit('duel_finished', { 
              winner_id: 'player1'  // Le joueur gagne
            });
          }
          
          activeDuels.delete(duelId);
          console.log(`🏆 Bot finished - Player wins duel ${duelId}`);
        }
      }, 3000); // 3 secondes de délai pour que le joueur puisse gagner avant
    }
    
    // Si le bot fait 3 erreurs, il est éliminé
    if (mistakes >= 3) {
      clearInterval(botInterval);
      
      const duelInfo = activeDuels.get(duelId);
      if (duelInfo && duelInfo.player1Socket) {
        io.to(duelInfo.player1Socket).emit('opponent_eliminated');
      }
      
      activeDuels.delete(duelId);
      console.log(`💀 Bot eliminated by 3 mistakes in duel ${duelId}`);
    }
    
  }, 5000); // Le bot joue toutes les 5 secondes
}

// ==========================================
// SOCKET SERVICE
// ==========================================

exports.initializeSocket = (socketIo) => {
  io = socketIo;
  
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);
    
    // ==========================================
    // MATCHMAKING
    // ==========================================
    
    // Search for duel opponent
    socket.on('search_duel', async ({ difficulty, userId }) => {
      try {
        console.log(`🔍 User ${userId} searching for ${difficulty} duel`);
        
        // Check if there's a waiting player
        if (!waitingPlayers.has(difficulty)) {
          waitingPlayers.set(difficulty, []);
        }
        
        const waiting = waitingPlayers.get(difficulty);
        
        if (waiting.length > 0) {
          // Match found with another real player!
          const opponent = waiting.shift();
          
          // Generate Sudoku
          const { grid, solution } = generateSudoku(difficulty);
          
          // Create duel in database
          const result = await Duel.create(opponent.userId, userId, grid, solution, difficulty);
          const duel = await Duel.findById(result.id);
          
          // Get usernames
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
          
          // Store active duel
          activeDuels.set(duel.id, {
            player1Socket: opponent.socketId,
            player2Socket: socket.id,
            player1Id: opponent.userId,
            player2Id: userId,
          });
          
          // Notify both players
          io.to(opponent.socketId).emit('duel_found', duelData);
          io.to(socket.id).emit('duel_found', duelData);
          
          console.log(`✅ Duel ${duel.id} created between ${opponent.userId} and ${userId}`);
          
        } else {
          // ✅ MODE TEST: Créer un duel avec le bot "amitest"
          console.log(`🤖 No players waiting, creating bot match for user ${userId}`);
          
          // Generate Sudoku
          const { grid, solution } = generateSudoku(difficulty);
          
          // Create duel with bot
          const result = await Duel.create(userId, BOT_USER.userId, grid, solution, difficulty);
          const duel = await Duel.findById(result.id);
          
          // Get real player username
          const player = await User.findById(userId);
          
          const duelData = {
            id: duel.id,
            player1_id: duel.player1_id,
            player2_id: duel.player2_id,
            player1_name: player.username,
            player2_name: BOT_USER.username,  // ← Bot name
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
          
          // Store active duel
          activeDuels.set(duel.id, {
            player1Socket: socket.id,
            player2Socket: BOT_USER.socketId,
            player1Id: userId,
            player2Id: BOT_USER.userId,
          });
          
          // Notify player
          io.to(socket.id).emit('duel_found', duelData);
          
          console.log(`✅ Bot duel ${duel.id} created for user ${userId}`);
          
          // ✅ Start bot simulation
          simulateBotPlay(duel.id, duel.solution);
        }
        
      } catch (error) {
        console.error('Search duel error:', error);
        socket.emit('error', { message: 'Failed to search for opponent' });
      }
    });
    
    // Cancel search
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
    
    // Update progress
    socket.on('update_progress', async ({ duel_id, progress, mistakes }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        // Determine which player
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        
        // Get duel to find player ID
        const duel = await Duel.findById(duel_id);
        const playerId = isPlayer1 ? duel.player1_id : duel.player2_id;
        
        // Update database
        await Duel.updateProgress(duel_id, playerId, progress, mistakes || 0);
        
        // Notify opponent (only if not bot)
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
    
    // Duel completed
    socket.on('duel_completed', async ({ duel_id }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        // Determine winner
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        const winnerId = isPlayer1 ? duelInfo.player1Id : duelInfo.player2Id;
        
        // Update database
        await Duel.complete(duel_id, winnerId);
        
        // Notify opponent (only if not bot)
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('duel_finished', { 
            winner_id: isPlayer1 ? 'player1' : 'player2' 
          });
        }
        
        // Remove from active duels
        activeDuels.delete(duel_id);
        
        console.log(`🏆 Duel ${duel_id} completed - Winner: ${winnerId}`);
        
      } catch (error) {
        console.error('Duel completed error:', error);
      }
    });
    
    // Player eliminated (3 mistakes)
    socket.on('player_eliminated', async ({ duel_id }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        // Determine loser and winner
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        const winnerId = isPlayer1 ? duelInfo.player2Id : duelInfo.player1Id;
        
        // Update database
        await Duel.complete(duel_id, winnerId);
        
        // Notify opponent (only if not bot)
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('opponent_eliminated');
        }
        
        // Remove from active duels
        activeDuels.delete(duel_id);
        
        console.log(`⚠️ Player eliminated in duel ${duel_id} - Winner: ${winnerId}`);
        
      } catch (error) {
        console.error('Player elimination error:', error);
      }
    });
    
    // Abandon duel
    socket.on('abandon_duel', async ({ duel_id }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        // Determine who abandoned and who wins
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        const winnerId = isPlayer1 ? duelInfo.player2Id : duelInfo.player1Id;
        
        // Update database
        await Duel.complete(duel_id, winnerId);
        
        // Notify opponent (only if not bot)
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('opponent_disconnected');
        }
        
        // Remove from active duels
        activeDuels.delete(duel_id);
        
        console.log(`🏃 Player abandoned duel ${duel_id} - Winner by default: ${winnerId}`);
        
      } catch (error) {
        console.error('Abandon duel error:', error);
      }
    });
    
    // ==========================================
    // IN-GAME MESSAGES
    // ==========================================
    
    // Send in-game message
    socket.on('duel_message', ({ duel_id, sender_id, content }) => {
      try {
        const duelInfo = activeDuels.get(duel_id);
        
        if (!duelInfo) return;
        
        const isPlayer1 = socket.id === duelInfo.player1Socket;
        const opponentSocket = isPlayer1 ? duelInfo.player2Socket : duelInfo.player1Socket;
        
        // Send message to opponent (only if not bot)
        if (opponentSocket !== BOT_USER.socketId) {
          io.to(opponentSocket).emit('duel_message', { 
            sender_id,
            content 
          });
        } else {
          // Bot responds with random message
          const botMessages = [
            '👍 Bien joué !',
            '😎 Continue comme ça',
            '🔥 Tu es en feu !',
          ];
          
          setTimeout(() => {
            io.to(socket.id).emit('duel_message', {
              sender_id: BOT_USER.userId,
              content: botMessages[Math.floor(Math.random() * botMessages.length)],
            });
          }, 1000);
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
      
      // Remove from waiting lists
      for (const [difficulty, waiting] of waitingPlayers.entries()) {
        const index = waiting.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          waiting.splice(index, 1);
          console.log(`🗑️ Removed from ${difficulty} waiting list`);
        }
      }
      
      // Handle active duels
      for (const [duelId, duelInfo] of activeDuels.entries()) {
        if (duelInfo.player1Socket === socket.id || duelInfo.player2Socket === socket.id) {
          const opponentSocket = duelInfo.player1Socket === socket.id 
            ? duelInfo.player2Socket 
            : duelInfo.player1Socket;
          
          const winnerId = duelInfo.player1Socket === socket.id
            ? duelInfo.player2Id
            : duelInfo.player1Id;
          
          // Update database
          Duel.complete(duelId, winnerId).catch(err => {
            console.error('Error completing duel on disconnect:', err);
          });
          
          // Notify opponent (only if not bot)
          if (opponentSocket !== BOT_USER.socketId) {
            io.to(opponentSocket).emit('opponent_disconnected');
          }
          
          // Remove from active duels
          activeDuels.delete(duelId);
          
          console.log(`🔌 Duel ${duelId} ended due to disconnect - Winner: ${winnerId}`);
        }
      }
    });
  });
};

exports.getIo = () => io;