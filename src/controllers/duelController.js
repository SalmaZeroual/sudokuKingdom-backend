const Duel = require('../models/Duel');
const User = require('../models/User');
const { generateSudoku } = require('../services/sudokuGenerator');
const db = require('../config/database');
const { getIo } = require('../services/socketService');

// ✅ Challenge friend - CRÉE UNE INVITATION
exports.challengeFriend = async (req, res) => {
  try {
    const { friend_id, difficulty } = req.body;
    const userId = req.userId;
    
    if (!friend_id || !difficulty) {
      return res.status(400).json({ error: 'Friend ID and difficulty are required' });
    }
    
    const friend = await User.findById(friend_id);
    
    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }
    
    db.run(
      `INSERT INTO duel_invitations (from_user_id, to_user_id, difficulty, status) 
       VALUES (?, ?, ?, 'pending')`,
      [userId, friend_id, difficulty],
      function(err) {
        if (err) {
          console.error('Create duel invitation error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        console.log(`✅ Duel invitation created: ${userId} → ${friend_id} (${difficulty})`);
        
        const io = getIo();
        if (io) {
          io.emit('new_duel_invitation', {
            to_user_id: friend_id,
            invitation_id: this.lastID,
          });
          console.log(`🔔 Emitted new_duel_invitation to user ${friend_id}`);
        }
        
        res.status(201).json({
          success: true,
          invitation_id: this.lastID,
          message: 'Invitation envoyée',
        });
      }
    );
    
  } catch (error) {
    console.error('Challenge friend error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Récupérer les invitations en attente
exports.getPendingInvitations = async (req, res) => {
  try {
    const userId = req.userId;
    
    const sql = `
      SELECT 
        di.id,
        di.from_user_id,
        di.difficulty,
        di.created_at,
        u.username as from_username,
        u.avatar as from_user_avatar
      FROM duel_invitations di
      JOIN users u ON di.from_user_id = u.id
      WHERE di.to_user_id = ? AND di.status = 'pending'
      ORDER BY di.created_at DESC
    `;
    
    db.all(sql, [userId], (err, rows) => {
      if (err) {
        console.error('Get pending invitations error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      console.log(`✅ Found ${rows.length} pending duel invitations for user ${userId}`);
      
      res.json(rows);
    });
    
  } catch (error) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Accepter une invitation - NOTIFIE LES 2 JOUEURS VIA SOCKET
exports.acceptInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.userId;
    
    console.log(`📥 User ${userId} accepting invitation ${invitationId}`);
    
    // Récupérer l'invitation
    db.get(
      'SELECT * FROM duel_invitations WHERE id = ? AND to_user_id = ? AND status = ?',
      [invitationId, userId, 'pending'],
      async (err, invitation) => {
        if (err) {
          console.error('Get invitation error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!invitation) {
          console.log(`❌ Invitation ${invitationId} not found or already processed`);
          return res.status(404).json({ error: 'Invitation not found' });
        }
        
        console.log(`✅ Invitation found: ${invitation.from_user_id} → ${userId}`);
        
        try {
          // Générer la grille
          const { grid, solution } = generateSudoku(invitation.difficulty);
          console.log(`✅ Sudoku grid generated for difficulty: ${invitation.difficulty}`);
          
          // Créer le duel
          const result = await Duel.create(
            invitation.from_user_id,
            userId,
            grid,
            solution,
            invitation.difficulty
          );
          
          const duel = await Duel.findById(result.id);
          
          // Marquer l'invitation comme acceptée
          db.run(
            'UPDATE duel_invitations SET status = ? WHERE id = ?',
            ['accepted', invitationId],
            (err) => {
              if (err) console.error('Update invitation error:', err);
            }
          );
          
          // Récupérer les noms des joueurs
          const player1 = await User.findById(invitation.from_user_id);
          const player2 = await User.findById(userId);
          
          console.log(`✅ Duel created from invitation ${invitationId}: ${player1.username} vs ${player2.username}`);
          
          const duelData = {
            id: duel.id,
            player1_id: duel.player1_id,
            player2_id: duel.player2_id,
            player1_name: player1.username,
            player2_name: player2.username,
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
          
          console.log(`🔍 DEBUG: About to emit duel_accepted with data:`, {
            player1_id: invitation.from_user_id,
            player2_id: userId,
            duel_id: duel.id,
            has_grid: !!duelData.grid,
            has_solution: !!duelData.solution
          });
          
          // ✅ Notifier les 2 joueurs via Socket.IO
          const io = getIo();
          if (io) {
            io.emit('duel_accepted', {
              duel: duelData,
              player1_id: invitation.from_user_id,
              player2_id: userId,
            });
            
            console.log(`🔔 Emitting duel_accepted to all clients:`, {
              player1_id: invitation.from_user_id,
              player2_id: userId,
              duel_id: duel.id
            });
          } else {
            console.log(`⚠️ WARNING: Socket.IO not available!`);
          }
          
          res.json(duelData);
          
        } catch (error) {
          console.error('Create duel from invitation error:', error);
          res.status(500).json({ error: 'Server error' });
        }
      }
    );
    
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Refuser une invitation
exports.declineInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.userId;
    
    db.run(
      'UPDATE duel_invitations SET status = ? WHERE id = ? AND to_user_id = ?',
      ['declined', invitationId, userId],
      function(err) {
        if (err) {
          console.error('Decline invitation error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        
        console.log(`✅ Duel invitation ${invitationId} declined`);
        
        res.json({ success: true, message: 'Invitation refusée' });
      }
    );
    
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Complete duel
exports.completeDuel = async (req, res) => {
  try {
    const { duelId } = req.params;
    const { time_elapsed } = req.body;
    const userId = req.userId;
    
    const duel = await Duel.findById(duelId);
    
    if (!duel) {
      return res.status(404).json({ error: 'Duel not found' });
    }
    
    if (duel.player1_id !== userId && duel.player2_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await Duel.complete(duelId, userId);
    await User.updateXP(userId, 100);
    
    const loserId = duel.player1_id === userId ? duel.player2_id : duel.player1_id;
    await User.resetStreak(loserId);
    
    res.json({ success: true, winner_id: userId });
    
  } catch (error) {
    console.error('Complete duel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send malus
exports.sendMalus = async (req, res) => {
  try {
    const { duelId } = req.params;
    const { malus_type } = req.body;
    const userId = req.userId;
    
    const duel = await Duel.findById(duelId);
    
    if (!duel) {
      return res.status(404).json({ error: 'Duel not found' });
    }
    
    if (duel.player1_id !== userId && duel.player2_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json({ success: true, malus_type });
    
  } catch (error) {
    console.error('Send malus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};