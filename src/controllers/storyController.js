const Story = require('../models/story');
const User = require('../models/User');
const { generateSudoku } = require('../services/sudokuGenerator');

// ==========================================
// GET KINGDOMS - Liste des 5 royaumes
// ==========================================

exports.getKingdoms = async (req, res) => {
  try {
    const userId = req.userId;
    
    const kingdoms = [
      {
        id: 1,
        name: 'Forêt Enchantée',
        description: 'Un royaume verdoyant où la magie coule à travers chaque feuille',
        icon: '🌳',
        color: '#10B981',
        character: 'Elora',
        characterTitle: 'Gardienne des Arbres',
        unlocked: true,
      },
      {
        id: 2,
        name: 'Désert des Mirages',
        description: 'Un désert mystérieux rempli d\'illusions et de secrets anciens',
        icon: '🏜️',
        color: '#F59E0B',
        character: 'Azrak',
        characterTitle: 'Sage du Désert',
        unlocked: false,
      },
      {
        id: 3,
        name: 'Océan des Profondeurs',
        description: 'Les mystères aquatiques attendent dans les profondeurs bleues',
        icon: '🌊',
        color: '#3B82F6',
        character: 'Marina',
        characterTitle: 'Sirène Érudite',
        unlocked: false,
      },
      {
        id: 4,
        name: 'Montagnes Célestes',
        description: 'Les sommets enneigés où résident les sages de l\'altitude',
        icon: '⛰️',
        color: '#6366F1',
        character: 'Kael',
        characterTitle: 'Moine de la Montagne',
        unlocked: false,
      },
      {
        id: 5,
        name: 'Cosmos Éternel',
        description: 'L\'espace infini regorge de connaissances cosmiques',
        icon: '🌌',
        color: '#8B5CF6',
        character: 'Stella',
        characterTitle: 'Archiviste Cosmique',
        unlocked: false,
      },
    ];
    
    // Get user progress for each kingdom
    for (const kingdom of kingdoms) {
      const progress = await Story.getKingdomProgress(userId, kingdom.id);
      kingdom.completed_chapters = progress.completed_chapters || 0;
      kingdom.total_chapters = progress.total_chapters || 10;
      kingdom.total_stars = progress.total_stars || 0;
      kingdom.max_stars = 30; // 10 chapters * 3 stars
      
      // Unlock logic
      if (kingdom.id > 1) {
        const previousKingdom = kingdoms[kingdom.id - 2];
        kingdom.unlocked = previousKingdom.completed_chapters >= 10;
      }
    }
    
    // Get artifacts
    const artifacts = await Story.getUserArtifacts(userId);
    
    // Get global stats
    const stats = await Story.getUserStats(userId);
    
    res.json({
      kingdoms,
      artifacts: artifacts.map(a => a.artifact_id),
      stats: {
        total_completed: stats.total_completed || 0,
        total_stars: stats.total_stars || 0,
        artifacts_collected: stats.artifacts_collected || 0,
        best_time: stats.best_time || 0,
        avg_time: stats.avg_time || 0,
      },
    });
    
  } catch (error) {
    console.error('Get kingdoms error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// GET CHAPTERS - Chapitres d'un royaume
// ==========================================

exports.getChapters = async (req, res) => {
  try {
    const userId = req.userId;
    const { kingdomId } = req.query;
    
    if (!kingdomId) {
      return res.status(400).json({ error: 'Kingdom ID required' });
    }
    
    const chapters = await Story.findByKingdom(parseInt(kingdomId));
    const userProgress = await Story.getUserProgress(userId);
    
    // Create a map of user progress
    const progressMap = {};
    userProgress.forEach(p => {
      progressMap[p.chapter_id] = {
        stars: p.stars,
        time_taken: p.time_taken,
        mistakes: p.mistakes,
        completed_at: p.completed_at,
      };
    });
    
    // Enrich chapters with user progress
    const enrichedChapters = chapters.map((chapter, index) => {
      const progress = progressMap[chapter.id] || {};
      const isCompleted = !!progress.stars;
      
      // Lock logic: first chapter unlocked, rest unlocked after previous is completed
      const isLocked = index > 0 && !progressMap[chapters[index - 1].id];
      
      return {
        id: chapter.id,
        kingdom_id: chapter.kingdom_id,
        chapter_id: chapter.chapter_id,
        title: chapter.title,
        description: chapter.description,
        difficulty: chapter.difficulty,
        chapter_order: chapter.chapter_order,
        story_text: chapter.story_text,
        objective_text: chapter.objective_text,
        is_completed: isCompleted,
        is_locked: isLocked,
        stars: progress.stars || 0,
        time_taken: progress.time_taken || 0,
        mistakes: progress.mistakes || 0,
        completed_at: progress.completed_at || null,
        // Don't send grid/solution to frontend for locked chapters
        grid: chapter.grid,
        solution: null, // Never send solution to frontend
      };
    });
    
    res.json(enrichedChapters);
    
  } catch (error) {
    console.error('Get chapters error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// GET CHAPTER DETAILS - Détails d'un chapitre
// ==========================================

exports.getChapterDetails = async (req, res) => {
  try {
    const userId = req.userId;
    const { chapterId } = req.params;
    
    const chapter = await Story.findById(parseInt(chapterId));
    
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    const userProgress = await Story.getUserProgress(userId);
    const progress = userProgress.find(p => p.chapter_id === chapter.id);
    
    // Check if chapter is unlocked
    const allChaptersInKingdom = await Story.findByKingdom(chapter.kingdom_id);
    const chapterIndex = allChaptersInKingdom.findIndex(c => c.id === chapter.id);
    
    let isLocked = false;
    if (chapterIndex > 0) {
      const previousChapter = allChaptersInKingdom[chapterIndex - 1];
      const previousProgress = userProgress.find(p => p.chapter_id === previousChapter.id);
      isLocked = !previousProgress;
    }
    
    if (isLocked) {
      return res.status(403).json({ error: 'Chapter locked' });
    }
    
    res.json({
      id: chapter.id,
      kingdom_id: chapter.kingdom_id,
      chapter_id: chapter.chapter_id,
      title: chapter.title,
      description: chapter.description,
      grid: chapter.grid,
      solution: chapter.solution,
      difficulty: chapter.difficulty,
      chapter_order: chapter.chapter_order,
      story_text: chapter.story_text,
      objective_text: chapter.objective_text,
      is_completed: !!progress,
      stars: progress ? progress.stars : 0,
      time_taken: progress ? progress.time_taken : 0,
      mistakes: progress ? progress.mistakes : 0,
    });
    
  } catch (error) {
    console.error('Get chapter details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// COMPLETE CHAPTER - Terminer un chapitre
// ==========================================

exports.completeChapter = async (req, res) => {
  try {
    const userId = req.userId;
    const { chapterId } = req.params;
    const { time_taken, mistakes } = req.body;
    
    const chapter = await Story.findById(parseInt(chapterId));
    
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    // Calculate stars (1-3)
    let stars = 1;
    
    // 3 stars: < 5 min + 0 errors
    if (time_taken < 300 && mistakes === 0) {
      stars = 3;
    }
    // 2 stars: < 10 min + < 3 errors
    else if (time_taken < 600 && mistakes < 3) {
      stars = 2;
    }
    
    // Save progress
    await Story.completeChapter(userId, chapter.id, stars, time_taken, mistakes);
    
    // Calculate XP reward
    let xpReward = 100; // Base XP
    xpReward += stars * 50; // Bonus per star
    
    if (stars === 3) {
      xpReward += 100; // Perfect bonus
    }
    
    // Award XP to user
    await User.updateXP(userId, xpReward);
    
    // Check for artifacts (hidden in chapters 5 and 10 of each kingdom)
    let artifactUnlocked = null;
    if (chapter.chapter_order === 5 || chapter.chapter_order === 10) {
      const artifactId = chapter.kingdom_id * 10 + (chapter.chapter_order === 5 ? 1 : 2);
      const result = await Story.collectArtifact(userId, artifactId);
      
      if (result.changes > 0) {
        artifactUnlocked = {
          id: artifactId,
          name: getArtifactName(chapter.kingdom_id, chapter.chapter_order),
          icon: getArtifactIcon(chapter.kingdom_id),
        };
      }
    }
    
    // Check if kingdom is completed
    const kingdomProgress = await Story.getKingdomProgress(userId, chapter.kingdom_id);
    const kingdomCompleted = kingdomProgress.completed_chapters >= 10;
    
    res.json({
      success: true,
      stars,
      xp_reward: xpReward,
      artifact: artifactUnlocked,
      kingdom_completed: kingdomCompleted,
    });
    
  } catch (error) {
    console.error('Complete chapter error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// INITIALIZE CHAPTERS - Seed des 50 chapitres
// ==========================================

exports.initializeChapters = async (req, res) => {
  try {
    const result = await ensureChaptersSeeded();
    res.json(result);
  } catch (error) {
    console.error('Initialize chapters error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ NOUVEAU : logique factorisée pour pouvoir être appelée automatiquement
// au démarrage du serveur (voir server.js), au lieu de dépendre d'un
// utilisateur qui clique sur un bouton caché pour "débloquer" le contenu.
// Idempotent : si les chapitres existent déjà, ne fait rien.
async function ensureChaptersSeeded() {
  const existingChapters = await Story.findAll();

  if (existingChapters.length > 0) {
    return { message: 'Chapters already initialized', count: existingChapters.length };
  }

  const chaptersData = generateAllChapters();

  let created = 0;
  for (const chapterData of chaptersData) {
    await Story.create(
      chapterData.kingdom_id,
      chapterData.chapter_id,
      chapterData.title,
      chapterData.description,
      chapterData.grid,
      chapterData.solution,
      chapterData.difficulty,
      chapterData.chapter_order,
      chapterData.story_text,
      chapterData.objective_text
    );
    created++;
  }

  console.log(`✅ ${created} chapitres Énigme générés automatiquement`);
  return { success: true, message: `${created} chapters created successfully` };
}

exports.ensureChaptersSeeded = ensureChaptersSeeded;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getArtifactName(kingdomId, chapterOrder) {
  const artifacts = {
    1: chapterOrder === 5 ? 'Couronne de Feuilles' : 'Sceptre de Vie',
    2: chapterOrder === 5 ? 'Urne Ancienne' : 'Amulette du Mirage',
    3: chapterOrder === 5 ? 'Trident de Cristal' : 'Perle des Profondeurs',
    4: chapterOrder === 5 ? 'Gemme de Glace' : 'Bâton du Sommet',
    5: chapterOrder === 5 ? 'Étoile Filante' : 'Orbe Cosmique',
  };
  return artifacts[kingdomId];
}

function getArtifactIcon(kingdomId) {
  const icons = {
    1: '🌿',
    2: '🏺',
    3: '🔱',
    4: '❄️',
    5: '⭐',
  };
  return icons[kingdomId];
}

function generateAllChapters() {
  const chapters = [];
  let globalId = 1;
  
  // Kingdom 1: Forêt Enchantée
  const forest = generateKingdomChapters(1, 'Forêt Enchantée', [
    { title: 'L\'Éveil de la Forêt', story: 'Un murmure ancien résonne...', objective: 'Résous l\'énigme pour éveiller l\'esprit de la forêt' },
    { title: 'Les Racines Entrelacées', story: 'Les racines cachent un secret...', objective: 'Déchiffre le langage des arbres' },
    { title: 'Le Chant des Feuilles', story: 'Le vent apporte un message...', objective: 'Écoute le chant et trouve le chemin' },
    { title: 'La Clairière Mystique', story: 'Une lumière étrange brille...', objective: 'Illumine la clairière sacrée' },
    { title: 'Le Gardien Endormi', story: 'Elora attend ton aide...', objective: 'Réveille le gardien ancestral' },
    { title: 'La Source de Vie', story: 'L\'eau magique coule...', objective: 'Purifie la source corrompue' },
    { title: 'Les Sentiers Perdus', story: 'Les chemins s\'entrecroisent...', objective: 'Trouve la voie vers le cœur de la forêt' },
    { title: 'L\'Arbre Ancien', story: 'Le plus vieil arbre parle...', objective: 'Décode le message millénaire' },
    { title: 'Le Rituel Druidique', story: 'La cérémonie commence...', objective: 'Complete le rituel sacré' },
    { title: 'L\'Harmonie Retrouvée', story: 'La forêt est sauvée !', objective: 'Restaure l\'équilibre final' },
  ], ['facile', 'facile', 'facile', 'moyen', 'moyen', 'moyen', 'moyen', 'difficile', 'difficile', 'difficile']);
  chapters.push(...forest);
  
  // Kingdom 2: Désert des Mirages
  const desert = generateKingdomChapters(2, 'Désert des Mirages', [
    { title: 'Les Dunes Mouvantes', story: 'Le sable cache des vérités...', objective: 'Traverse les dunes changeantes' },
    { title: 'L\'Oasis Illusoire', story: 'Est-ce réel ou illusion ?', objective: 'Découvre la vraie oasis' },
    { title: 'Les Pyramides Oubliées', story: 'Des structures anciennes émergent...', objective: 'Perce les secrets des pyramides' },
    { title: 'Le Sphinx Énigmatique', story: 'Une question millénaire...', objective: 'Résous l\'énigme du sphinx' },
    { title: 'La Chambre des Miroirs', story: 'Les reflets mentent...', objective: 'Distingue le vrai du faux' },
    { title: 'Le Temple du Soleil', story: 'La chaleur révèle...', objective: 'Déchiffre les inscriptions solaires' },
    { title: 'La Caravane Perdue', story: 'Des voyageurs attendent...', objective: 'Guide la caravane à bon port' },
    { title: 'Le Trésor Enfoui', story: 'Des richesses cachées...', objective: 'Découvre le trésor ancien' },
    { title: 'La Tempête de Sable', story: 'Le désert se déchaîne...', objective: 'Survit à la tempête' },
    { title: 'La Sagesse du Désert', story: 'Azrak partage sa connaissance...', objective: 'Maîtrise l\'enseignement final' },
  ], ['facile', 'facile', 'moyen', 'moyen', 'moyen', 'moyen', 'difficile', 'difficile', 'difficile', 'extreme']);
  chapters.push(...desert);
  
  // Kingdom 3: Océan des Profondeurs
  const ocean = generateKingdomChapters(3, 'Océan des Profondeurs', [
    { title: 'La Surface Argentée', story: 'Les vagues murmurent...', objective: 'Plonge dans l\'océan mystérieux' },
    { title: 'Les Récifs Coralliens', story: 'La vie foisonne...', objective: 'Explore le jardin sous-marin' },
    { title: 'La Grotte Bioluminescente', story: 'Des lumières dansent...', objective: 'Découvre la grotte cachée' },
    { title: 'Le Léviathan Endormi', story: 'Une créature géante dort...', objective: 'Ne réveille pas le géant' },
    { title: 'La Cité Engloutie', story: 'Une civilisation perdue...', objective: 'Explore les ruines antiques' },
    { title: 'Le Chant de la Sirène', story: 'Marina t\'appelle...', objective: 'Suis le chant mélodieux' },
    { title: 'La Fosse Abyssale', story: 'Les ténèbres profondes...', objective: 'Descend dans l\'abysse' },
    { title: 'Le Portail Aquatique', story: 'Un passage s\'ouvre...', objective: 'Traverse le portail mystique' },
    { title: 'Le Trident Perdu', story: 'L\'arme légendaire attend...', objective: 'Récupère le trident sacré' },
    { title: 'Le Gardien des Océans', story: 'Le maître des mers apparaît...', objective: 'Gagne la faveur du gardien' },
  ], ['moyen', 'moyen', 'moyen', 'moyen', 'difficile', 'difficile', 'difficile', 'difficile', 'extreme', 'extreme']);
  chapters.push(...ocean);
  
  // Kingdom 4: Montagnes Célestes
  const mountains = generateKingdomChapters(4, 'Montagnes Célestes', [
    { title: 'L\'Ascension Commence', story: 'Le sommet t\'appelle...', objective: 'Commence l\'escalade sacrée' },
    { title: 'Le Col Venteux', story: 'Les vents hurlent...', objective: 'Traverse le col dangereux' },
    { title: 'Le Monastère Isolé', story: 'Des moines silencieux...', objective: 'Apprend la sagesse des moines' },
    { title: 'La Caverne de Glace', story: 'Le froid éternel...', objective: 'Explore la grotte gelée' },
    { title: 'Le Dragon de Neige', story: 'Une créature majestueuse...', objective: 'Gagne la confiance du dragon' },
    { title: 'Les Escaliers Célestes', story: 'Mille marches vers le ciel...', objective: 'Monte vers les nuages' },
    { title: 'La Forge du Sommet', story: 'Le feu dans la glace...', objective: 'Maîtrise l\'art des forgerons' },
    { title: 'L\'Oracle du Pic', story: 'Une voyante attend...', objective: 'Consulte l\'oracle mystique' },
    { title: 'L\'Avalanche Maudite', story: 'La montagne gronde...', objective: 'Échappe à l\'avalanche' },
    { title: 'Le Sommet Éternel', story: 'Le point le plus haut...', objective: 'Atteins le sommet ultime' },
  ], ['moyen', 'moyen', 'difficile', 'difficile', 'difficile', 'difficile', 'difficile', 'extreme', 'extreme', 'extreme']);
  chapters.push(...mountains);
  
  // Kingdom 5: Cosmos Éternel
  const cosmos = generateKingdomChapters(5, 'Cosmos Éternel', [
    { title: 'Le Premier Saut', story: 'L\'espace t\'accueille...', objective: 'Lance-toi dans le cosmos' },
    { title: 'La Nébuleuse Dansante', story: 'Des couleurs cosmiques...', objective: 'Traverse la nébuleuse' },
    { title: 'La Station Abandonnée', story: 'Une base flottante...', objective: 'Explore la station perdue' },
    { title: 'Le Trou Noir Captif', story: 'La gravité déforme tout...', objective: 'Échape à l\'attraction fatale' },
    { title: 'La Constellation Vivante', story: 'Les étoiles forment des patterns...', objective: 'Déchiffre la constellation' },
    { title: 'Le Vaisseau Fantôme', story: 'Un navire dérive...', objective: 'Monte à bord du vaisseau hanté' },
    { title: 'La Supernova Imminente', story: 'Une étoile va exploser...', objective: 'Survit à l\'explosion stellaire' },
    { title: 'La Bibliothèque Infinie', story: 'Stella garde le savoir...', objective: 'Accède à la connaissance ultime' },
    { title: 'Le Portail Temporel', story: 'Le temps se plie...', objective: 'Maîtrise le voyage temporel' },
    { title: 'L\'Origine de Tout', story: 'Le secret de l\'univers...', objective: 'Comprend l\'énigme cosmique finale' },
  ], ['difficile', 'difficile', 'difficile', 'difficile', 'extreme', 'extreme', 'extreme', 'extreme', 'extreme', 'extreme']);
  chapters.push(...cosmos);
  
  return chapters;
}

function generateKingdomChapters(kingdomId, kingdomName, chaptersInfo, difficulties) {
  const chapters = [];
  
  for (let i = 0; i < chaptersInfo.length; i++) {
    const { title, story, objective } = chaptersInfo[i];
    const difficulty = difficulties[i];
    
    // Generate Sudoku grid
    const { grid, solution } = generateSudoku(difficulty);
    
    chapters.push({
      kingdom_id: kingdomId,
      chapter_id: kingdomId * 100 + (i + 1),
      title,
      description: `Chapitre ${i + 1} - ${kingdomName}`,
      grid,
      solution,
      difficulty,
      chapter_order: i + 1,
      story_text: story,
      objective_text: objective,
    });
  }
  
  return chapters;
}