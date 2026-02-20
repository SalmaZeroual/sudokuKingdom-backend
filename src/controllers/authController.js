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
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Create user
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
        
        // Create initial boosters
        await Booster.create(userId, 'reveal_cell', 3);
        await Booster.create(userId, 'freeze_time', 2);
        await Booster.create(userId, 'swap_cells', 5);
        
        // Send verification email
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
    
    // Find user
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
        
        // Check code
        if (user.verification_code !== code) {
          return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // Check expiration
        const now = new Date();
        const expires = new Date(user.verification_code_expires);
        
        if (now > expires) {
          return res.status(400).json({ error: 'Verification code expired' });
        }
        
        // Verify email
        db.run(
          'UPDATE users SET email_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?',
          [user.id],
          async (err) => {
            if (err) {
              console.error('Update user error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            // Send welcome email
            await sendWelcomeEmail(email, user.username);
            
            // Generate token
            const token = generateToken(user.id);
            
            // Get updated user
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
    
    // Find user
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
        
        // Generate new code
        const verificationCode = generateVerificationCode();
        const codeExpires = new Date(Date.now() + 10 * 60 * 1000);
        
        // Update user
        db.run(
          'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
          [verificationCode, codeExpires.toISOString(), user.id],
          async (err) => {
            if (err) {
              console.error('Update user error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            // Send email
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
    
    // Check if email is verified
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

// ✅ AMÉLIORÉ: Get current user avec league à jour
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ✅ Vérifier si la league est à jour
    const correctLeague = User.calculateLeague(user.xp);
    
    if (user.league !== correctLeague) {
      // Mettre à jour si nécessaire
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

// ✅ NOUVEAU: Obtenir le classement de la league
exports.getLeagueLeaderboard = async (req, res) => {
  try {
    const { league } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const leaderboard = await User.getLeagueLeaderboard(league, limit);
    
    // Ajouter le rang
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

// ✅ NOUVEAU: Obtenir le classement global
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

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          console.error('Find user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        // Don't reveal if user exists or not (security)
        if (!user) {
          return res.json({ 
            message: 'Si cet email existe, un code de réinitialisation a été envoyé.' 
          });
        }
        
        // Generate reset code
        const resetCode = generateVerificationCode();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        // Store reset code
        db.run(
          'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
          [resetCode, codeExpires.toISOString(), user.id],
          async (err) => {
            if (err) {
              console.error('Update user error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            // Send reset email
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

// Verify reset code
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    
    // Find user
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
        
        // Check code
        if (user.verification_code !== code) {
          return res.status(400).json({ error: 'Invalid reset code' });
        }
        
        // Check expiration
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

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Find user
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
        
        // Check code
        if (user.verification_code !== code) {
          return res.status(400).json({ error: 'Invalid reset code' });
        }
        
        // Check expiration
        const now = new Date();
        const expires = new Date(user.verification_code_expires);
        
        if (now > expires) {
          return res.status(400).json({ error: 'Reset code expired' });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        
        // Update password and clear reset code
        db.run(
          'UPDATE users SET password_hash = ?, verification_code = NULL, verification_code_expires = NULL WHERE id = ?',
          [passwordHash, user.id],
          (err) => {
            if (err) {
              console.error('Update password error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            res.json({ 
              message: 'Password reset successfully',
              success: true 
            });
          }
        );
      }
    );
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};