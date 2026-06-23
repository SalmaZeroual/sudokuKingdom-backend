const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth');

// Route semi-publique : fonctionne sans token, mais si token présent
// → inclut user_has_joined dans chaque tournoi (évite "Erreur inscription")
router.get('/list', optionalAuthenticate, tournamentController.listTournaments);

// Protected routes
router.use(authenticate);

router.get('/:id', tournamentController.getTournament);
router.post('/:id/join', tournamentController.joinTournament);
router.get('/:id/leaderboard', tournamentController.getLeaderboard);
router.post('/:id/submit', tournamentController.submitScore);

module.exports = router;