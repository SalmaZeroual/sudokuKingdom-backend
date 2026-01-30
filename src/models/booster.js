const db = require('../config/database');

class Booster {
  static create(userId, boosterType, quantity) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO user_boosters (user_id, booster_type, quantity) 
        VALUES (?, ?, ?)
      `;
      
      db.run(sql, [userId, boosterType, quantity], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }
  
  static findByUser(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_boosters WHERE user_id = ?';
      
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static findByType(userId, boosterType) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_boosters WHERE user_id = ? AND booster_type = ?';
      
      db.get(sql, [userId, boosterType], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  static use(userId, boosterType) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE user_boosters 
        SET quantity = quantity - 1 
        WHERE user_id = ? AND booster_type = ? AND quantity > 0
      `;
      
      db.run(sql, [userId, boosterType], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
  
  static add(userId, boosterType, quantity) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE user_boosters 
        SET quantity = quantity + ? 
        WHERE user_id = ? AND booster_type = ?
      `;
      
      db.run(sql, [quantity, userId, boosterType], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = Booster;