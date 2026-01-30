const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { authenticate } = require('../middlewares/auth');

// All routes are protected
router.use(authenticate);

router.post('/start', gameController.startGame);
router.post('/:gameId/complete', gameController.completeGame);
router.get('/boosters', gameController.getBoosters);
router.post('/use-booster', gameController.useBooster);
router.get('/history', gameController.getGameHistory);

module.exports = router;