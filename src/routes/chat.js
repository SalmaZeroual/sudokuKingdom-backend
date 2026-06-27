const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middlewares/auth');

// All routes are protected
router.use(authenticate);

// Conversations
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:friendId/get-or-create', chatController.getOrCreateConversation);
router.delete('/conversations/:conversationId', chatController.deleteConversation);

// Messages
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', chatController.sendMessage);
router.post('/conversations/:conversationId/read', chatController.markAsRead);

// ✅ NOUVEAU : statut d'une conversation (peut-on envoyer un message ?)
router.get('/conversations/:conversationId/status', chatController.getConversationStatus);

// ✅ NOUVEAU : bloquer/débloquer les messages d'un ami (sans casser l'amitié)
router.post('/block/:friendId', chatController.blockUser);
router.delete('/block/:friendId', chatController.unblockUser);

// Unread count
router.get('/unread-count', chatController.getUnreadCount);

module.exports = router;