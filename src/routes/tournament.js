const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const { authenticate } = require('../middlewares/auth');

// Public route
router.get('/list', tournamentController.getTournaments);

// Protected routes
router.use(authenticate);

router.get('/:tournamentId', tournamentController.getTournamentDetails);
router.post('/:tournamentId/join', tournamentController.joinTournament);
router.get('/:tournamentId/leaderboard', tournamentController.getLeaderboard);
router.post('/:tournamentId/submit', tournamentController.submitScore);

module.exports = router;