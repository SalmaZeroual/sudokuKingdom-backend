const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Booster = require('../models/Booster');
const { generateVerificationCode, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const db = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Register
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const verificationCode = generateVerificationCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    db.run(
      `INSERT INTO users (username, email, password_hash, verification_code, verification_code_expires, email_verified) 
       VALUES (?, ?, ?, ?, ?, 0)`,
      [username, email, passwordHash, verificationCode, codeExpires.toISOString()],
      async function(err) {
        if (err) {
          console.error('Create user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        const userId = this.lastID;
        
        await Booster.create(userId, 'reveal_cell', 3);
        await Booster.create(userId, 'freeze_time', 2);
        await Booster.create(userId, 'swap_cells', 5);
        
        const emailSent = await sendVerificationEmail(email, username, verificationCode);
        
        if (!emailSent) {
          console.warn('⚠️ Failed to send verification email');
        }
        
        res.status(201).json({
          message: 'Account created successfully. Please check your email for verification code.',
          userId: userId,
          email: email,
          requiresVerification: true,
        });
      }
    );
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          console.error('Find user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.email_verified === 1) {
          return res.status(400).json({ error: 'Email already verified' });
        }
        
        if (user.verification_code !== code) {
          return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        const now = new Date();
        const expires = new Date(user.verification_code_expires);
        
        if (now > expires) {
          return res.status(400).json({ error: 'Verification code expired' });
        }
        
        db.run(
          'UPDATE users SET email_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?',
          [user.id],
          async (err) => {
            if (err) {
              console.error('Update user error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            await sendWelcomeEmail(email, user.username);
            
            const token = generateToken(user.id);
            const updatedUser = await User.findById(user.id);
            
            res.json({
              message: 'Email verified successfully',
              token,
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
                email_verified: true,
              },
            });
          }
        );
      }
    );
    
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Resend verification code
exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          console.error('Find user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.email_verified === 1) {
          return res.status(400).json({ error: 'Email already verified' });
        }
        
        const verificationCode = generateVerificationCode();
        const codeExpires = new Date(Date.now() + 10 * 60 * 1000);
        
        db.run(
          'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
          [verificationCode, codeExpires.toISOString(), user.id],
          async (err) => {
            if (err) {
              console.error('Update user error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            const emailSent = await sendVerificationEmail(email, user.username, verificationCode);
            
            if (!emailSent) {
              return res.status(500).json({ error: 'Failed to send email' });
            }
            
            res.json({ message: 'Verification code sent successfully' });
          }
        );
      }
    );
    
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.email_verified === 0) {
      return res.status(403).json({ 
        error: 'Email not verified',
        requiresVerification: true,
        email: email 
      });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user.id);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        xp: user.xp,
        level: user.level,
        avatar: user.avatar,
        wins: user.wins,
        streak: user.streak,
        league: user.league,
      },
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const correctLeague = User.calculateLeague(user.xp);
    
    if (user.league !== correctLeague) {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET league = ? WHERE id = ?',
          [correctLeague, user.id],
          (err) => err ? reject(err) : resolve()
        );
      });
      
      user.league = correctLeague;
      console.log(`✅ League mise à jour pour ${user.username}: ${correctLeague}`);
    }
    
    res.json(user);
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get league leaderboard
exports.getLeagueLeaderboard = async (req, res) => {
  try {
    const { league } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const leaderboard = await User.getLeagueLeaderboard(league, limit);
    
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1
    }));
    
    res.json(rankedLeaderboard);
    
  } catch (error) {
    console.error('Get league leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get global leaderboard
exports.getGlobalLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const leaderboard = await User.getGlobalLeaderboard(limit);
    
    res.json(leaderboard);
    
  } catch (error) {
    console.error('Get global leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// PASSWORD RESET FUNCTIONS
// ==========================================

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          console.error('Find user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
          return res.json({ 
            message: 'Si cet email existe, un code de réinitialisation a été envoyé.' 
          });
        }
        
        const resetCode = generateVerificationCode();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000);
        
        db.run(
          'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
          [resetCode, codeExpires.toISOString(), user.id],
          async (err) => {
            if (err) {
              console.error('Update user error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            const emailSent = await sendPasswordResetEmail(email, user.username, resetCode);
            
            if (!emailSent) {
              console.warn('⚠️ Failed to send password reset email');
              return res.status(500).json({ error: 'Failed to send email' });
            }
            
            res.json({ 
              message: 'Si cet email existe, un code de réinitialisation a été envoyé.',
              email: email 
            });
          }
        );
      }
    );
    
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      (err, user) => {
        if (err) {
          console.error('Find user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.verification_code !== code) {
          return res.status(400).json({ error: 'Invalid reset code' });
        }
        
        const now = new Date();
        const expires = new Date(user.verification_code_expires);
        
        if (now > expires) {
          return res.status(400).json({ error: 'Reset code expired' });
        }
        
        res.json({ 
          message: 'Code verified successfully',
          valid: true 
        });
      }
    );
    
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }
    
    const now = new Date();
    const expires = new Date(user.verification_code_expires);
    
    if (now > expires) {
      return res.status(400).json({ error: 'Reset code expired' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    const updateResult = await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password_hash = ?, verification_code = NULL, verification_code_expires = NULL WHERE id = ?',
        [passwordHash, user.id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
    
    if (updateResult.changes === 0) {
      return res.status(500).json({ error: 'Failed to update password' });
    }
    
    res.json({ 
      message: 'Mot de passe réinitialisé avec succès',
      success: true 
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// ✅ DELETE ACCOUNT
// ==========================================

exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.userId;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // SELECT * directement pour avoir password_hash
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // ✅ Supprimer uniquement le compte (pas de table boosters)
    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM users WHERE id = ?',
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    console.log(`🗑️ Compte supprimé : ${user.username} (ID: ${userId})`);

    res.json({ message: 'Compte supprimé avec succès' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};