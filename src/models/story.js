const db = require('../config/database');

class Story {
  // ==========================================
  // CHAPTERS - Gestion des chapitres
  // ==========================================
  
  static create(kingdomId, chapterId, title, description, grid, solution, difficulty, order, storyText, objectiveText) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO story_chapters 
        (kingdom_id, chapter_id, title, description, grid, solution, difficulty, chapter_order, story_text, objective_text) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [
        kingdomId, 
        chapterId, 
        title, 
        description, 
        JSON.stringify(grid), 
        JSON.stringify(solution), 
        difficulty, 
        order, 
        storyText,
        objectiveText
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findAll() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM story_chapters 
        ORDER BY kingdom_id ASC, chapter_order ASC
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else {
          rows.forEach(row => {
            row.grid = JSON.parse(row.grid);
            row.solution = JSON.parse(row.solution);
          });
          resolve(rows);
        }
      });
    });
  }
  
  static findByKingdom(kingdomId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM story_chapters 
        WHERE kingdom_id = ?
        ORDER BY chapter_order ASC
      `;
      
      db.all(sql, [kingdomId], (err, rows) => {
        if (err) reject(err);
        else {
          rows.forEach(row => {
            row.grid = JSON.parse(row.grid);
            row.solution = JSON.parse(row.solution);
          });
          resolve(rows);
        }
      });
    });
  }
  
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM story_chapters WHERE id = ?';
      
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else {
          if (row) {
            row.grid = JSON.parse(row.grid);
            row.solution = JSON.parse(row.solution);
          }
          resolve(row);
        }
      });
    });
  }
  
  // ==========================================
  // USER PROGRESS - Progression utilisateur
  // ==========================================
  
  static getUserProgress(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT chapter_id, stars, time_taken, mistakes, completed_at 
        FROM story_progress 
        WHERE user_id = ?
        ORDER BY completed_at DESC
      `;
      
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static completeChapter(userId, chapterId, stars, timeTaken, mistakes) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO story_progress (user_id, chapter_id, stars, time_taken, mistakes, completed_at) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, chapter_id) DO UPDATE SET 
          stars = CASE WHEN excluded.stars > story_progress.stars THEN excluded.stars ELSE story_progress.stars END,
          time_taken = CASE WHEN excluded.time_taken < story_progress.time_taken THEN excluded.time_taken ELSE story_progress.time_taken END,
          mistakes = CASE WHEN excluded.mistakes < story_progress.mistakes THEN excluded.mistakes ELSE story_progress.mistakes END,
          completed_at = CURRENT_TIMESTAMP
      `;
      
      db.run(sql, [userId, chapterId, stars, timeTaken, mistakes], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static getKingdomProgress(userId, kingdomId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT sp.chapter_id) as completed_chapters,
          SUM(sp.stars) as total_stars,
          (SELECT COUNT(*) FROM story_chapters WHERE kingdom_id = ?) as total_chapters
        FROM story_progress sp
        JOIN story_chapters sc ON sp.chapter_id = sc.id
        WHERE sp.user_id = ? AND sc.kingdom_id = ?
      `;
      
      db.get(sql, [kingdomId, userId, kingdomId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  // ==========================================
  // ARTIFACTS - Artefacts collectibles
  // ==========================================
  
  static collectArtifact(userId, artifactId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR IGNORE INTO story_artifacts (user_id, artifact_id, collected_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;
      
      db.run(sql, [userId, artifactId], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
  
  static getUserArtifacts(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT artifact_id, collected_at 
        FROM story_artifacts 
        WHERE user_id = ?
      `;
      
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  // ==========================================
  // STATISTICS - Statistiques globales
  // ==========================================
  
  static getUserStats(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT chapter_id) as total_completed,
          SUM(stars) as total_stars,
          (SELECT COUNT(*) FROM story_artifacts WHERE user_id = ?) as artifacts_collected,
          MIN(time_taken) as best_time,
          AVG(time_taken) as avg_time
        FROM story_progress
        WHERE user_id = ?
      `;
      
      db.get(sql, [userId, userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = Story;