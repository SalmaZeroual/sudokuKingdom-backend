const Game = require('../models/Game');
const User = require('../models/User');
const Booster = require('../models/Booster');
const { generateSudoku } = require('../services/sudokuGenerator');
const { calculateXP } = require('../services/xpService');
const db = require('../config/database');

// Start new game
exports.startGame = async (req, res) => {
  try {
    const { mode, difficulty } = req.body;
    const userId = req.userId;
    
    // Validate input
    if (!mode || !difficulty) {
      return res.status(400).json({ error: 'Mode and difficulty are required' });
    }
    
    // Generate Sudoku grid
    const { grid, solution } = generateSudoku(difficulty);
    
    // Create game
    const result = await Game.create(userId, grid, solution, difficulty, mode);
    
    // Get created game
    const game = await Game.findById(result.id);
    
    res.status(201).json({
      id: game.id,
      user_id: game.user_id,
      grid: game.grid,
      solution: game.solution,
      difficulty: game.difficulty,
      mode: game.mode,
      status: game.status,
      time_elapsed: game.time_elapsed,
      mistakes: game.mistakes,
      created_at: game.created_at,
    });
    
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Complete game
exports.completeGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { time_elapsed, mistakes } = req.body;
    const userId = req.userId;
    
    // Get game
    const game = await Game.findById(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Update game status
    await Game.complete(gameId, time_elapsed, mistakes);
    
    // Calculate XP
    const xpEarned = calculateXP(game.difficulty, time_elapsed, mistakes);
    
    // Update user XP and stats
    await User.updateXP(userId, xpEarned);
    
    // Get updated user
    const user = await User.findById(userId);
    
    res.json({
      xp_earned: xpEarned,
      user: {
        id: user.id,
        username: user.username,
        xp: user.xp,
        level: user.level,
        wins: user.wins,
        streak: user.streak,
      },
    });
    
  } catch (error) {
    console.error('Complete game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Save game progress
exports.saveProgress = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { grid, time_elapsed, mistakes } = req.body;
    const userId = req.userId;
    
    // Verify ownership
    const game = await Game.findById(gameId);
    
    if (!game || game.user_id !== userId) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Update progress
    db.run(
      `UPDATE games SET grid = ?, time_elapsed = ?, mistakes = ? WHERE id = ?`,
      [JSON.stringify(grid), time_elapsed, mistakes, gameId],
      function(err) {
        if (err) {
          console.error('Save progress error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ success: true, message: 'Progress saved' });
      }
    );
    
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get active game
exports.getActiveGame = async (req, res) => {
  try {
    const userId = req.userId;
    
    db.get(
      `SELECT * FROM games 
       WHERE user_id = ? AND status = 'in_progress' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId],
      (err, row) => {
        if (err) {
          console.error('Get active game error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!row) {
          return res.json({ game: null });
        }
        
        row.grid = JSON.parse(row.grid);
        row.solution = JSON.parse(row.solution);
        
        res.json({ game: row });
      }
    );
    
  } catch (error) {
    console.error('Get active game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get boosters
exports.getBoosters = async (req, res) => {
  try {
    const userId = req.userId;
    const boosters = await Booster.findByUser(userId);
    
    res.json(boosters);
    
  } catch (error) {
    console.error('Get boosters error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Use booster
exports.useBooster = async (req, res) => {
  try {
    const { booster_type } = req.body;
    const userId = req.userId;
    
    // Check if user has booster
    const booster = await Booster.findByType(userId, booster_type);
    
    if (!booster || booster.quantity <= 0) {
      return res.status(400).json({ error: 'Booster not available' });
    }
    
    // Decrease booster quantity
    await Booster.use(userId, booster_type);
    
    res.json({ success: true, message: 'Booster used' });
    
  } catch (error) {
    console.error('Use booster error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get game history
exports.getGameHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const games = await Game.getHistory(userId, 20);
    
    res.json(games);
    
  } catch (error) {
    console.error('Get game history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};