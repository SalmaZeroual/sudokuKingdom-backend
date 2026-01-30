const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { authenticate } = require('../middlewares/auth');

// Protected routes
router.use(authenticate);

router.get('/chapters', storyController.getChapters);
router.get('/chapters/:chapterId', storyController.getChapterDetails);
router.post('/chapters/:chapterId/complete', storyController.completeChapter);

// Admin route to initialize chapters
router.post('/initialize', storyController.initializeChapters);

module.exports = router;