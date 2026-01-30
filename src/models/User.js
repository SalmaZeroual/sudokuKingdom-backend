const db = require('../config/database');

class User {
  static create(username, email, passwordHash) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO users (username, email, password_hash) 
        VALUES (?, ?, ?)
      `;
      
      db.run(sql, [username, email, passwordHash], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, email, xp, level, avatar, wins, streak, league, created_at 
        FROM users 
        WHERE id = ?
      `;
      
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE email = ?';
      
      db.get(sql, [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE username = ?';
      
      db.get(sql, [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  static updateXP(userId, xpToAdd) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users 
        SET xp = xp + ?, 
            wins = wins + 1, 
            streak = streak + 1,
            level = CASE WHEN (xp + ?) >= level * 100 THEN level + 1 ELSE level END
        WHERE id = ?
      `;
      
      db.run(sql, [xpToAdd, xpToAdd, userId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
  
  static resetStreak(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET streak = 0 WHERE id = ?';
      
      db.run(sql, [userId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
  
  static search(query, excludeUserId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, level, avatar, xp, league
        FROM users
        WHERE username LIKE ? AND id != ?
        LIMIT 20
      `;
      
      db.all(sql, [`%${query}%`, excludeUserId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = User;