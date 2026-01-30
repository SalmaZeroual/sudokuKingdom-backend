const db = require('../config/database');

class Story {
  static create(chapterId, title, description, grid, solution, difficulty, order) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO story_chapters (chapter_id, title, description, grid, solution, difficulty, chapter_order) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [chapterId, title, description, JSON.stringify(grid), JSON.stringify(solution), difficulty, order], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findAll() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM story_chapters 
        ORDER BY chapter_order ASC
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
  
  static getUserProgress(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT chapter_id, completed_at 
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
  
  static completeChapter(userId, chapterId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO story_progress (user_id, chapter_id, completed_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, chapter_id) DO UPDATE SET completed_at = CURRENT_TIMESTAMP
      `;
      
      db.run(sql, [userId, chapterId], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
}

module.exports = Story;