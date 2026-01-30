const express = require('express');
const router = express.Router();
const duelController = require('../controllers/duelController');
const { authenticate } = require('../middlewares/auth');

// All routes are protected
router.use(authenticate);

router.post('/challenge', duelController.challengeFriend);
router.post('/:duelId/complete', duelController.completeDuel);
router.post('/:duelId/malus', duelController.sendMalus);

module.exports = router;