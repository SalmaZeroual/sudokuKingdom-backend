const db = require('../config/database');

class Game {
  static create(userId, grid, solution, difficulty, mode) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO games (user_id, grid, solution, difficulty, mode) 
        VALUES (?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [userId, JSON.stringify(grid), JSON.stringify(solution), difficulty, mode], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM games WHERE id = ?';
      
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
  
  static complete(gameId, timeElapsed, mistakes) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE games 
        SET status = 'completed', 
            time_elapsed = ?, 
            mistakes = ?, 
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(sql, [timeElapsed, mistakes, gameId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
  
  static getHistory(userId, limit = 20) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, difficulty, mode, status, time_elapsed, mistakes, created_at, completed_at 
        FROM games 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      db.all(sql, [userId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Game;