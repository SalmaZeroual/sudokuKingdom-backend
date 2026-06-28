const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth');

// Routes publiques (accessibles hors ligne / invité)
// optionalAuthenticate : définit req.userId si token valide, sinon userId = undefined
router.get('/kingdoms', optionalAuthenticate, storyController.getKingdoms);
router.get('/chapters', optionalAuthenticate, storyController.getChapters);
router.get('/chapters/:chapterId', optionalAuthenticate, storyController.getChapterDetails);

// Routes protégées (nécessitent un compte)
router.post('/chapters/:chapterId/complete', authenticate, storyController.completeChapter);
router.post('/initialize', authenticate, storyController.initializeChapters);

module.exports = router;