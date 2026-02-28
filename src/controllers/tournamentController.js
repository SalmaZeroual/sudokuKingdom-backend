const Tournament = require('../models/Tournament');
const TournamentParticipation = require('../models/TournamentParticipation');
const { generateSudoku } = require('../services/sudokuGenerator');

// ✅ NOUVEAU: Vérifier et créer les tournois du dimanche si nécessaire
async function ensureSundayTournaments() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Dimanche
  
  // Si ce n'est pas dimanche, ne rien faire
  if (dayOfWeek !== 0) {
    return;
  }
  
  // Vérifier si des tournois existent déjà pour aujourd'hui
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  
  const existingTournaments = await Tournament.getActiveTournaments();
  
  // Si des tournois existent déjà et sont valides pour aujourd'hui, ne rien faire
  if (existingTournaments.length > 0) {
    const firstTournament = existingTournaments[0];
    const tournamentStart = new Date(firstTournament.start_date);
    
    // Vérifier si le tournoi est bien pour aujourd'hui
    if (tournamentStart.toDateString() === startOfDay.toDateString()) {
      console.log('✅ Tournois du dimanche déjà créés');
      return;
    }
  }
  
  // Créer les 4 tournois du dimanche
  console.log('🏆 Création automatique des tournois du dimanche...');
  
  const tournaments = [
    { name: 'Tournoi Facile', difficulty: 'facile' },
    { name: 'Tournoi Moyen', difficulty: 'moyen' },
    { name: 'Tournoi Difficile', difficulty: 'difficile' },
    { name: 'Tournoi Extrême', difficulty: 'extreme' },
  ];
  
  for (const config of tournaments) {
    try {
      const { grid, solution } = generateSudoku(config.difficulty);
      
      await Tournament.create({
        name: config.name,
        grid,
        solution,
        difficulty: config.difficulty,
        startDate: startOfDay,
        endDate: endOfDay,
      });
      
      console.log(`   ✅ ${config.name} créé`);
    } catch (error) {
      console.error(`   ❌ Erreur création ${config.name}:`, error);
    }
  }
  
  console.log('✅ Tournois du dimanche créés automatiquement !');
}

// Get all active tournaments
exports.listTournaments = async (req, res) => {
  try {
    // ✅ Vérifier et créer les tournois si nécessaire
    await ensureSundayTournaments();
    
    const tournaments = await Tournament.getActiveTournaments();
    
    // Add participant count for each tournament
    const tournamentsWithData = await Promise.all(
      tournaments.map(async (tournament) => {
        const participants = await TournamentParticipation.getTournamentParticipants(tournament.id);
        return {
          ...tournament,
          participants: participants.length,
        };
      })
    );
    
    res.json(tournamentsWithData);
  } catch (error) {
    console.error('List tournaments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get tournament details
exports.getTournament = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Check if user has participated
    const userId = req.userId;
    const participation = await TournamentParticipation.findByUserAndTournament(userId, id);
    
    res.json({
      ...tournament,
      hasParticipated: !!participation,
      userParticipation: participation,
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Join tournament
exports.joinTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Check if tournament exists and is active
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    if (tournament.status !== 'active') {
      return res.status(400).json({ error: 'Tournament is not active' });
    }
    
    // Check if tournament has ended
    const now = new Date();
    const endDate = new Date(tournament.end_date);
    
    if (now > endDate) {
      return res.status(400).json({ error: 'Tournament has ended' });
    }
    
    // Check if user has already participated
    const existingParticipation = await TournamentParticipation.findByUserAndTournament(userId, id);
    
    if (existingParticipation) {
      return res.status(400).json({ error: 'Already participated in this tournament' });
    }
    
    // Create participation
    const participation = await TournamentParticipation.create(userId, id);
    
    res.json({
      message: 'Successfully joined tournament',
      participation,
      tournament,
    });
  } catch (error) {
    console.error('Join tournament error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Submit score
exports.submitScore = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { score, time } = req.body;
    
    if (!score || !time) {
      return res.status(400).json({ error: 'Score and time are required' });
    }
    
    // Check if user has participated
    const participation = await TournamentParticipation.findByUserAndTournament(userId, id);
    
    if (!participation) {
      return res.status(400).json({ error: 'You must join the tournament first' });
    }
    
    // Update score (only if better than previous or first submission)
    if (!participation.score || score > participation.score) {
      await TournamentParticipation.updateScore(participation.id, score, time);
    }
    
    res.json({
      message: 'Score submitted successfully',
      score,
      time,
    });
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    
    const participants = await TournamentParticipation.getLeaderboard(id);
    
    res.json(participants);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user's tournaments
exports.getUserTournaments = async (req, res) => {
  try {
    const userId = req.userId;
    
    const participations = await TournamentParticipation.getUserParticipations(userId);
    
    res.json(participations);
  } catch (error) {
    console.error('Get user tournaments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};