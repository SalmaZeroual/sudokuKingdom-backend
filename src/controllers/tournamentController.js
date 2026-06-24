const Tournament = require('../models/Tournament');
const TournamentParticipation = require('../models/TournamentParticipation');
const { generateSudoku } = require('../services/sudokuGenerator');

// ✅ Génère les 4 tournois quotidiens si pas encore créés pour aujourd'hui
async function ensureDailyTournaments() {
  const now = new Date();

  // Début et fin du jour courant (minuit → minuit)
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Vérifier si des tournois actifs existent déjà pour aujourd'hui
  const existingTournaments = await Tournament.getActiveTournaments();

  if (existingTournaments.length > 0) {
    const firstTournament = existingTournaments[0];
    const tournamentStart = new Date(firstTournament.start_date);

    if (tournamentStart.toDateString() === startOfDay.toDateString()) {
      console.log('✅ Tournois quotidiens déjà créés pour aujourd\'hui');
      return;
    }
  }

  // Créer les 4 tournois du jour
  console.log('🏆 Création automatique des tournois quotidiens...');

  const configs = [
    { name: 'Tournoi Facile',    difficulty: 'facile'    },
    { name: 'Tournoi Moyen',     difficulty: 'moyen'     },
    { name: 'Tournoi Difficile', difficulty: 'difficile' },
    { name: 'Tournoi Extrême',   difficulty: 'extreme'   },
  ];

  for (const config of configs) {
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

  console.log('✅ Tournois quotidiens créés automatiquement !');
}

// ─────────────────────────────────────────────
// GET /tournament/list
// Optionnellement authentifié. Retourne par tournoi :
//   user_has_joined   : a rejoint (même sans score)
//   user_has_finished : a soumis un score > 0
// Le client affiche :
//   - "Participer"  si !user_has_joined
//   - "Continuer"   si user_has_joined && !user_has_finished
//   - "Classement"  si user_has_finished
// ─────────────────────────────────────────────
exports.listTournaments = async (req, res) => {
  try {
    await ensureDailyTournaments();

    const tournaments = await Tournament.getActiveTournaments();
    const userId = req.userId || null;

    const tournamentsWithData = await Promise.all(
      tournaments.map(async (tournament) => {
        const participants = await TournamentParticipation.getTournamentParticipants(tournament.id);

        let userHasJoined = false;
        let userHasFinished = false;

        if (userId) {
          const participation = await TournamentParticipation.findByUserAndTournament(userId, tournament.id);
          if (participation) {
            userHasJoined = true;
            userHasFinished = participation.score > 0;
          }
        }

        return {
          ...tournament,
          participants: participants.length,
          user_has_joined: userHasJoined,
          user_has_finished: userHasFinished,
        };
      })
    );

    res.json(tournamentsWithData);
  } catch (error) {
    console.error('List tournaments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /tournament/:id
// ─────────────────────────────────────────────
exports.getTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

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

// ─────────────────────────────────────────────
// POST /tournament/:id/join
// ─────────────────────────────────────────────
exports.joinTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status !== 'active') {
      return res.status(400).json({ error: 'Tournament is not active' });
    }

    if (new Date() > new Date(tournament.end_date)) {
      return res.status(400).json({ error: 'Tournament has ended' });
    }

    const existingParticipation = await TournamentParticipation.findByUserAndTournament(userId, id);

    // ✅ Fix : si le joueur a déjà rejoint mais n'a pas encore soumis de score
    // (il est sorti avant la fin), on lui retourne sa participation existante
    // pour qu'il puisse reprendre la partie. On ne bloque plus avec une 400.
    if (existingParticipation) {
      const canResume = !existingParticipation.score || existingParticipation.score === 0;
      if (canResume) {
        return res.json({
          message: 'Resuming existing participation',
          participation: existingParticipation,
          tournament,
          isResume: true,
        });
      }
      // Score déjà soumis → vraiment terminé, on bloque
      return res.status(400).json({ error: 'Already completed this tournament' });
    }

    const participation = await TournamentParticipation.create(userId, id);

    res.json({ message: 'Successfully joined tournament', participation, tournament });
  } catch (error) {
    console.error('Join tournament error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /tournament/:id/submit
// ─────────────────────────────────────────────
exports.submitScore = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { score, time } = req.body;

    if (!score || !time) {
      return res.status(400).json({ error: 'Score and time are required' });
    }

    const participation = await TournamentParticipation.findByUserAndTournament(userId, id);

    if (!participation) {
      return res.status(400).json({ error: 'You must join the tournament first' });
    }

    if (!participation.score || score > participation.score) {
      await TournamentParticipation.updateScore(participation.id, score, time);
    }

    res.json({ message: 'Score submitted successfully', score, time });
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /tournament/:id/leaderboard
// query: ?type=global|friends
// ─────────────────────────────────────────────
exports.getLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'global' } = req.query; // 'global' ou 'friends'
    const userId = req.userId;

    let participants;

    if (type === 'friends') {
      // Classement uniquement parmi les amis de l'utilisateur
      participants = await TournamentParticipation.getFriendsLeaderboard(id, userId);
    } else {
      // Classement mondial complet
      participants = await TournamentParticipation.getLeaderboard(id);
    }

    res.json(participants);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /tournament/user/history
// ─────────────────────────────────────────────
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