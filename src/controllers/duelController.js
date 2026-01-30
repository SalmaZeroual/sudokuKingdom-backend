const Duel = require('../models/Duel');
const User = require('../models/User');
const { generateSudoku } = require('../services/sudokuGenerator');
const db = require('../config/database');

// Challenge friend
exports.challengeFriend = async (req, res) => {
  try {
    const { friend_id, difficulty } = req.body;
    const userId = req.userId;
    
    // Validate input
    if (!friend_id || !difficulty) {
      return res.status(400).json({ error: 'Friend ID and difficulty are required' });
    }
    
    // Check if friend exists
    const friend = await User.findById(friend_id);
    
    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }
    
    // Generate Sudoku grid
    const { grid, solution } = generateSudoku(difficulty);
    
    // Create duel
    const result = await Duel.create(userId, friend_id, grid, solution, difficulty);
    
    // Get created duel
    const duel = await Duel.findById(result.id);
    
    // Get usernames
    const player1 = await User.findById(userId);
    const player2 = await User.findById(friend_id);
    
    res.status(201).json({
      id: duel.id,
      player1_id: duel.player1_id,
      player2_id: duel.player2_id,
      player1_name: player1.username,
      player2_name: player2.username,
      grid: duel.grid,
      solution: duel.solution,
      difficulty: duel.difficulty,
      status: duel.status,
      player1_progress: duel.player1_progress,
      player2_progress: duel.player2_progress,
      player1_mistakes: duel.player1_mistakes,
      player2_mistakes: duel.player2_mistakes,
      created_at: duel.created_at,
    });
    
  } catch (error) {
    console.error('Challenge friend error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Complete duel
exports.completeDuel = async (req, res) => {
  try {
    const { duelId } = req.params;
    const { time_elapsed } = req.body;
    const userId = req.userId;
    
    // Get duel
    const duel = await Duel.findById(duelId);
    
    if (!duel) {
      return res.status(404).json({ error: 'Duel not found' });
    }
    
    // Check if user is in duel
    if (duel.player1_id !== userId && duel.player2_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Update duel with winner
    await Duel.complete(duelId, userId);
    
    // Update winner stats
    await User.updateXP(userId, 100); // Bonus XP for winning
    
    // Reset loser streak
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
    
    // Get duel
    const duel = await Duel.findById(duelId);
    
    if (!duel) {
      return res.status(404).json({ error: 'Duel not found' });
    }
    
    // Check if user is in duel
    if (duel.player1_id !== userId && duel.player2_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Malus will be handled via WebSocket
    res.json({ success: true, malus_type });
    
  } catch (error) {
    console.error('Send malus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};