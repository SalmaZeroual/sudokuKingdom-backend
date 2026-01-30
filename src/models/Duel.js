const db = require('../config/database');

class Duel {
  static create(player1Id, player2Id, grid, solution, difficulty) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO duels (player1_id, player2_id, grid, solution, difficulty, status) 
        VALUES (?, ?, ?, ?, ?, 'active')
      `;
      
      db.run(sql, [player1Id, player2Id, JSON.stringify(grid), JSON.stringify(solution), difficulty], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM duels WHERE id = ?';
      
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
  
  static updateProgress(duelId, playerId, progress, mistakes) {
    return new Promise((resolve, reject) => {
      // Check if player1 or player2
      db.get('SELECT player1_id FROM duels WHERE id = ?', [duelId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const isPlayer1 = row.player1_id === playerId;
        const sql = isPlayer1
          ? 'UPDATE duels SET player1_progress = ?, player1_mistakes = ? WHERE id = ?'
          : 'UPDATE duels SET player2_progress = ?, player2_mistakes = ? WHERE id = ?';
        
        db.run(sql, [progress, mistakes, duelId], function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        });
      });
    });
  }
  
  static complete(duelId, winnerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE duels 
        SET winner_id = ?, status = 'finished' 
        WHERE id = ?
      `;
      
      db.run(sql, [winnerId, duelId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = Duel;