const db = require('../config/database');

class Leaderboard {
  static update(userId, league, points, week, year) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO leaderboards (user_id, league, points, week, year) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, week, year) 
        DO UPDATE SET points = points + ?, league = ?
      `;
      
      db.run(sql, [userId, league, points, week, year, points, league], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static getByLeague(league, week, year, limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT l.*, u.username, u.avatar
        FROM leaderboards l
        JOIN users u ON l.user_id = u.id
        WHERE l.league = ? AND l.week = ? AND l.year = ?
        ORDER BY l.points DESC
        LIMIT ?
      `;
      
      db.all(sql, [league, week, year, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static getGlobal(week, year, limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT l.*, u.username, u.avatar, u.league
        FROM leaderboards l
        JOIN users u ON l.user_id = u.id
        WHERE l.week = ? AND l.year = ?
        ORDER BY l.points DESC
        LIMIT ?
      `;
      
      db.all(sql, [week, year, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static getUserRank(userId, week, year) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) + 1 as rank
        FROM leaderboards
        WHERE points > (
          SELECT points FROM leaderboards 
          WHERE user_id = ? AND week = ? AND year = ?
        ) AND week = ? AND year = ?
      `;
      
      db.get(sql, [userId, week, year, week, year], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.rank : null);
      });
    });
  }
}

module.exports = Leaderboard;