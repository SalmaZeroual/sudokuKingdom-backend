const Story = require('../src/models/Story');
const { generateSudoku } = require('../services/sudokuGenerator');

// Get all chapters
exports.getChapters = async (req, res) => {
  try {
    const userId = req.userId;
    
    const chapters = await Story.findAll();
    const progress = await Story.getUserProgress(userId);
    
    const completedChapterIds = progress.map(p => p.chapter_id);
    
    // Add completion status
    const chaptersWithProgress = chapters.map(chapter => ({
      ...chapter,
      is_completed: completedChapterIds.includes(chapter.chapter_id),
      is_locked: chapter.chapter_order > 1 && !completedChapterIds.includes(chapter.chapter_order - 1),
    }));
    
    res.json(chaptersWithProgress);
    
  } catch (error) {
    console.error('Get chapters error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get chapter details
exports.getChapterDetails = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const chapter = await Story.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    res.json(chapter);
    
  } catch (error) {
    console.error('Get chapter details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Complete chapter
exports.completeChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.userId;
    
    await Story.completeChapter(userId, chapterId);
    
    res.json({ success: true, message: 'Chapter completed' });
    
  } catch (error) {
    console.error('Complete chapter error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Initialize default chapters
exports.initializeChapters = async (req, res) => {
  try {
    // Check if chapters exist
    const existing = await Story.findAll();
    
    if (existing.length > 0) {
      return res.json({ message: 'Chapters already initialized' });
    }
    
    // Create 3 default chapters
    const chapters = [
      {
        chapter_id: 1,
        title: 'Le Royaume Perdu',
        description: 'Libérez le royaume des griffes du sorcier maléfique',
        difficulty: 'facile',
        order: 1,
      },
      {
        chapter_id: 2,
        title: 'La Forêt Enchantée',
        description: 'Traversez la forêt mystérieuse remplie de dangers',
        difficulty: 'moyen',
        order: 2,
      },
      {
        chapter_id: 3,
        title: 'Le Temple Ancien',
        description: 'Découvrez les secrets du temple et ses trésors',
        difficulty: 'difficile',
        order: 3,
      },
    ];
    
    for (const chapter of chapters) {
      const { grid, solution } = generateSudoku(chapter.difficulty);
      await Story.create(
        chapter.chapter_id,
        chapter.title,
        chapter.description,
        grid,
        solution,
        chapter.difficulty,
        chapter.order
      );
    }
    
    res.json({ success: true, message: 'Chapters initialized' });
    
  } catch (error) {
    console.error('Initialize chapters error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};