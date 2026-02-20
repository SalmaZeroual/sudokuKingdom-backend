const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { authenticate } = require('../middlewares/auth');

// Protected routes
router.use(authenticate);

// Get all kingdoms with progress
router.get('/kingdoms', storyController.getKingdoms);

// Get chapters for a specific kingdom
router.get('/chapters', storyController.getChapters);

// Get specific chapter details
router.get('/chapters/:chapterId', storyController.getChapterDetails);

// Complete a chapter
router.post('/chapters/:chapterId/complete', storyController.completeChapter);

// Admin route to initialize chapters (IMPORTANT)
router.post('/initialize', storyController.initializeChapters);

module.exports = router;