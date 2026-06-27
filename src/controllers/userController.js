const bcrypt = require('bcryptjs');
const User = require('../models/User');
const db = require('../config/database');

// ==========================================
// UPDATE USERNAME
// ==========================================
exports.updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.userId; // From auth middleware
    
    // Validation
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (username.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' 
      });
    }
    
    if (username.trim().length > 30) {
      return res.status(400).json({ 
        error: 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères' 
      });
    }
    
    // Check if username is already taken by another user
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username.trim(), userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Ce nom d\'utilisateur est déjà utilisé' 
      });
    }
    
    // Update username
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET username = ? WHERE id = ?',
        [username.trim(), userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
    
    // Get updated user
    const updatedUser = await User.findById(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✅ Username updated for user ${userId}: ${updatedUser.username}`);
    
    res.json({
      message: 'Profil mis à jour avec succès',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        xp: updatedUser.xp,
        level: updatedUser.level,
        avatar: updatedUser.avatar,
        wins: updatedUser.wins,
        streak: updatedUser.streak,
        league: updatedUser.league,
      },
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
};

// ==========================================
// CHANGE PASSWORD
// ==========================================
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.userId; // From auth middleware
    
    // Validation
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Veuillez fournir l\'ancien et le nouveau mot de passe' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' 
      });
    }
    
    if (oldPassword === newPassword) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit être différent de l\'ancien' 
      });
    }
    
    // Get user with password hash
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, password_hash FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
    
    console.log(`✅ Password changed for user ${userId}: ${user.username}`);
    
    res.json({
      message: 'Mot de passe modifié avec succès',
      success: true,
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
};

// ==========================================
// GET USER PROFILE
// ==========================================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      xp: user.xp,
      level: user.level,
      avatar: user.avatar,
      wins: user.wins,
      streak: user.streak,
      league: user.league,
      created_at: user.created_at,
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// ✅ NOUVEAU : UPDATE AVATAR
// ==========================================
exports.updateAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    const userId = req.userId; // From auth middleware
    
    // Validation
    if (!avatar) {
      return res.status(400).json({ error: 'Avatar is required' });
    }
    
    // Liste des avatars valides (même liste que Flutter)
    const validAvatars = [
      'king', 'queen', 'prince', 'princess', 'crown',
      'knight', 'ninja', 'viking', 'samurai', 'wizard', 'archer',
      'dragon', 'unicorn', 'phoenix', 'wolf', 'eagle', 'lion',
      'star', 'diamond', 'trophy', 'lightning', 'fire',
      'rocket', 'robot', 'alien', 'ghost', 'skull',
      'rainbow', 'moon', 'sun'
    ];
    
    // Vérifier que l'avatar est valide
    if (!validAvatars.includes(avatar)) {
      return res.status(400).json({ 
        error: 'Avatar invalide' 
      });
    }
    
    // Update avatar
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET avatar = ? WHERE id = ?',
        [avatar, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
    
    // Get updated user
    const updatedUser = await User.findById(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✅ Avatar updated for user ${userId}: ${avatar}`);
    
    res.json({
      message: 'Avatar mis à jour avec succès',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        xp: updatedUser.xp,
        level: updatedUser.level,
        avatar: avatar,
        wins: updatedUser.wins,
        streak: updatedUser.streak,
        league: updatedUser.league,
      },
    });
    
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'avatar' });
  }
};

// ══════════════════════════════════════════════
// PATCH /user/discoverability
// Permet à l'utilisateur de choisir comment il
// peut être trouvé : 'id_only' ou 'username'
// ══════════════════════════════════════════════
exports.updateDiscoverability = async (req, res) => {
  try {
    const { discoverability } = req.body;
    const userId = req.userId;

    if (!['id_only', 'username'].includes(discoverability)) {
      return res.status(400).json({
        error: "Valeur invalide. Utilisez 'id_only' ou 'username'."
      });
    }

    // Ajouter la colonne si elle n'existe pas encore (migration douce)
    const db = require('../config/database');
    await new Promise((resolve) => {
      db.run(
        "ALTER TABLE users ADD COLUMN discoverability TEXT DEFAULT 'id_only'",
        () => resolve() // ignore error si la colonne existe déjà
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET discoverability = ? WHERE id = ?',
        [discoverability, userId],
        (err) => err ? reject(err) : resolve()
      );    });

    res.json({ discoverability });
  } catch (error) {
    console.error('Update discoverability error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ NOUVEAU : préférence globale "accepter les messages des autres
// joueurs". Si désactivé, personne (même un ami) ne peut envoyer de
// message, y compris dans une conversation déjà existante.
exports.updateMessagePrivacy = async (req, res) => {
  try {
    const { accepts_messages } = req.body;
    const userId = req.userId;

    if (typeof accepts_messages !== 'boolean') {
      return res.status(400).json({ error: "Valeur invalide. Utilisez true ou false." });
    }

    const db = require('../config/database');
    // Migration douce, comme pour discoverability.
    await new Promise((resolve) => {
      db.run(
        'ALTER TABLE users ADD COLUMN accepts_messages INTEGER DEFAULT 1',
        () => resolve()
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET accepts_messages = ? WHERE id = ?',
        [accepts_messages ? 1 : 0, userId],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({ accepts_messages });
  } catch (error) {
    console.error('Update message privacy error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};