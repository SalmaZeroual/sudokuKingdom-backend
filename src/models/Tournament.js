const db = require('../config/database');

class Tournament {
  static create(name, grid, solution, difficulty, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tournaments (name, grid, solution, difficulty, start_date, end_date) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [name, JSON.stringify(grid), JSON.stringify(solution), difficulty, startDate, endDate], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findAll() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT t.*, 
               COUNT(DISTINCT tp.user_id) as participants
        FROM tournaments t
        LEFT JOIN tournament_participations tp ON t.id = tp.tournament_id
        WHERE t.status = 'active' AND t.end_date > CURRENT_TIMESTAMP
        GROUP BY t.id
        ORDER BY t.start_date DESC
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
      const sql = `
        SELECT t.*, 
               COUNT(DISTINCT tp.user_id) as participants
        FROM tournaments t
        LEFT JOIN tournament_participations tp ON t.id = tp.tournament_id
        WHERE t.id = ?
        GROUP BY t.id
      `;
      
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
  
  static join(tournamentId, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tournament_participations (tournament_id, user_id) 
        VALUES (?, ?)
      `;
      
      db.run(sql, [tournamentId, userId], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static updateScore(tournamentId, userId, score, time) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE tournament_participations 
        SET score = ?, time = ? 
        WHERE tournament_id = ? AND user_id = ?
      `;
      
      db.run(sql, [score, time, tournamentId, userId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
  
  static getLeaderboard(tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT tp.*, u.username
        FROM tournament_participations tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
        ORDER BY tp.score DESC, tp.time ASC
        LIMIT 100
      `;
      
      db.all(sql, [tournamentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Tournament;