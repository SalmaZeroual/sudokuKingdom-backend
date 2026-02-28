const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const { authenticate } = require('../middlewares/auth');

// ✅ Public route - FIX: listTournaments au lieu de getTournaments
router.get('/list', tournamentController.listTournaments);

// Protected routes
router.use(authenticate);

router.get('/:id', tournamentController.getTournament);
router.post('/:id/join', tournamentController.joinTournament);
router.get('/:id/leaderboard', tournamentController.getLeaderboard);
router.post('/:id/submit', tournamentController.submitScore);

module.exports = router;