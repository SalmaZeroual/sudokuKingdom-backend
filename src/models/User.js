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
  
  // ✅ NOUVEAU: Calculer la league selon les XP
  static calculateLeague(xp) {
    if (xp >= 12000) return 'Legend';
    if (xp >= 8000) return 'Master';
    if (xp >= 5000) return 'Diamond';
    if (xp >= 3000) return 'Platinum';
    if (xp >= 1500) return 'Gold';
    if (xp >= 500) return 'Silver';
    return 'Bronze';
  }
  
  // ✅ AMÉLIORÉ: Mise à jour XP + League automatique
  static async updateXP(userId, xpToAdd) {
    return new Promise(async (resolve, reject) => {
      try {
        // 1. Récupérer l'utilisateur actuel
        const user = await User.findById(userId);
        if (!user) {
          return reject(new Error('User not found'));
        }
        
        // 2. Calculer les nouvelles valeurs
        const newXP = user.xp + xpToAdd;
        const newLevel = Math.floor(newXP / 100) + 1; // 100 XP par niveau
        const newLeague = User.calculateLeague(newXP);
        
        // 3. Mettre à jour la base de données
        const sql = `
          UPDATE users 
          SET xp = ?, 
              level = ?,
              league = ?,
              wins = wins + 1, 
              streak = streak + 1
          WHERE id = ?
        `;
        
        db.run(sql, [newXP, newLevel, newLeague, userId], function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ User ${userId}: ${user.xp} → ${newXP} XP | ${user.league} → ${newLeague}`);
            resolve({ 
              changes: this.changes,
              newXP,
              newLevel,
              newLeague,
              oldLeague: user.league,
              promoted: newLeague !== user.league
            });
          }
        });
        
      } catch (error) {
        reject(error);
      }
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
  
  // ✅ NOUVEAU: Obtenir le classement de la league
  static getLeagueLeaderboard(league, limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, xp, level, avatar, wins, streak
        FROM users
        WHERE league = ?
        ORDER BY xp DESC
        LIMIT ?
      `;
      
      db.all(sql, [league, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  // ✅ NOUVEAU: Obtenir le classement global
  static getGlobalLeaderboard(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, xp, level, avatar, wins, streak, league
        FROM users
        ORDER BY xp DESC
        LIMIT ?
      `;
      
      db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else {
          // Ajouter le rang
          const rankedRows = rows.map((row, index) => ({
            ...row,
            rank: index + 1
          }));
          resolve(rankedRows);
        }
      });
    });
  }
  
  // ✅ NOUVEAU: Forcer la mise à jour de toutes les leagues (migration)
  static async updateAllLeagues() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, xp FROM users', [], async (err, users) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`📊 Mise à jour de ${users.length} utilisateurs...`);
        
        for (const user of users) {
          const newLeague = User.calculateLeague(user.xp);
          await new Promise((res, rej) => {
            db.run(
              'UPDATE users SET league = ? WHERE id = ?',
              [newLeague, user.id],
              (err) => err ? rej(err) : res()
            );
          });
        }
        
        console.log('✅ Toutes les leagues ont été mises à jour !');
        resolve({ updated: users.length });
      });
    });
  }
}

module.exports = User;