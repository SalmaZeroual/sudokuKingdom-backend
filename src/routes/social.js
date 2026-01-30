const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const { authenticate } = require('../middlewares/auth');

// All routes are protected
router.use(authenticate);

router.get('/friends', socialController.getFriends);
router.post('/friends/request', socialController.sendFriendRequest);
router.post('/friends/accept/:friendshipId', socialController.acceptFriendRequest);
router.post('/friends/reject/:friendshipId', socialController.rejectFriendRequest);
router.delete('/friends/:friendId', socialController.removeFriend);
router.get('/friends/pending', socialController.getPendingRequests);
router.get('/friends/:friendId/stats', socialController.getFriendStats);
router.get('/users/search', socialController.searchUsers);

module.exports = router;