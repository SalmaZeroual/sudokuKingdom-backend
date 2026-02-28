const db = require('../config/database');

class TournamentParticipation {
  static create(userId, tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tournament_participations (user_id, tournament_id, joined_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;
      
      db.run(sql, [userId, tournamentId], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findByUserAndTournament(userId, tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tournament_participations 
        WHERE user_id = ? AND tournament_id = ?
      `;
      
      db.get(sql, [userId, tournamentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  static getTournamentParticipants(tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT tp.*, u.username, u.avatar, u.level
        FROM tournament_participations tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
      `;
      
      db.all(sql, [tournamentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static updateScore(participationId, score, time) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE tournament_participations 
        SET score = ?, time = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(sql, [score, time, participationId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
  
  static getLeaderboard(tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          tp.*,
          u.username,
          u.avatar,
          u.level,
          ROW_NUMBER() OVER (ORDER BY tp.score DESC, tp.time ASC) as rank
        FROM tournament_participations tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ? AND tp.score IS NOT NULL
        ORDER BY tp.score DESC, tp.time ASC
        LIMIT 100
      `;
      
      db.all(sql, [tournamentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static getUserParticipations(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          tp.*,
          t.name as tournament_name,
          t.difficulty,
          t.start_date,
          t.end_date,
          t.status as tournament_status
        FROM tournament_participations tp
        JOIN tournaments t ON tp.tournament_id = t.id
        WHERE tp.user_id = ?
        ORDER BY tp.joined_at DESC
      `;
      
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = TournamentParticipation;