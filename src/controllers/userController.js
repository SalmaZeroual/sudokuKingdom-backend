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
// GET USER PROFILE (OPTIONAL - if not already exists)
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