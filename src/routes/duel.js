const express = require('express');
const router = express.Router();
const duelController = require('../controllers/duelController');
const { authenticate } = require('../middlewares/auth');

// All routes are protected
router.use(authenticate);

// ✅ INVITATIONS
router.post('/challenge', duelController.challengeFriend); // Crée une invitation
router.get('/invitations', duelController.getPendingInvitations); // Récupère les invitations
router.post('/invitations/:invitationId/accept', duelController.acceptInvitation); // Accepte
router.post('/invitations/:invitationId/decline', duelController.declineInvitation); // Refuse

// ✅ DUELS
router.post('/:duelId/complete', duelController.completeDuel);
router.post('/:duelId/malus', duelController.sendMalus);

module.exports = router;