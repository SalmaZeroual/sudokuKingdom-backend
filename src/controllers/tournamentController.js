const Tournament = require('../models/Tournament');

// Get tournaments list
exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.findAll();
    res.json(tournaments);
    
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get tournament details
exports.getTournamentDetails = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    res.json(tournament);
    
  } catch (error) {
    console.error('Get tournament details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Join tournament
exports.joinTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const userId = req.userId;
    
    // Check if tournament exists
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Join tournament
    await Tournament.join(tournamentId, userId);
    
    res.json({ success: true, message: 'Joined tournament successfully' });
    
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Already joined this tournament' });
    }
    
    console.error('Join tournament error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get tournament leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const leaderboard = await Tournament.getLeaderboard(tournamentId);
    
    // Update ranks
    const db = require('../config/database');
    
    for (let i = 0; i < leaderboard.length; i++) {
      leaderboard[i].rank = i + 1;
      
      db.run(
        'UPDATE tournament_participations SET rank = ? WHERE id = ?',
        [i + 1, leaderboard[i].id]
      );
    }
    
    res.json(leaderboard);
    
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Submit tournament score
exports.submitScore = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { score, time } = req.body;
    const userId = req.userId;
    
    // Update score
    await Tournament.updateScore(tournamentId, userId, score, time);
    
    res.json({ success: true, message: 'Score submitted' });
    
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};