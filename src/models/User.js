const db = require('../config/database');

class User {
  // ✅ NOUVEAU : Générer un ID unique à 10 chiffres
  static generateUniqueId() {
    return new Promise(async (resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        // Générer un nombre aléatoire de 10 chiffres
        const uniqueId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        
        // Vérifier s'il existe déjà
        const exists = await new Promise((res, rej) => {
          db.get(
            'SELECT id FROM users WHERE unique_id = ?',
            [uniqueId],
            (err, row) => {
              if (err) rej(err);
              else res(!!row);
            }
          );
        });
        
        if (!exists) {
          return resolve(uniqueId);
        }
        
        attempts++;
      }
      
      reject(new Error('Failed to generate unique ID after ' + maxAttempts + ' attempts'));
    });
  }
  
  static create(username, email, passwordHash) {
    return new Promise(async (resolve, reject) => {
      try {
        // Générer l'ID unique à 10 chiffres
        const uniqueId = await User.generateUniqueId();
        
        const sql = `
          INSERT INTO users (username, email, password_hash, unique_id) 
          VALUES (?, ?, ?, ?)
        `;
        
        db.run(sql, [username, email, passwordHash, uniqueId], function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, uniqueId });
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, email, xp, level, avatar, wins, streak, league, unique_id, created_at 
        FROM users 
        WHERE id = ?
      `;
      
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  // ✅ NOUVEAU : Trouver par unique_id (10 chiffres)
  static findByUniqueId(uniqueId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, level, avatar, xp, league, unique_id
        FROM users 
        WHERE unique_id = ?
      `;
      
      db.get(sql, [uniqueId], (err, row) => {
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
  
  static calculateLeague(xp) {
    if (xp >= 12000) return 'Legend';
    if (xp >= 8000) return 'Master';
    if (xp >= 5000) return 'Diamond';
    if (xp >= 3000) return 'Platinum';
    if (xp >= 1500) return 'Gold';
    if (xp >= 500) return 'Silver';
    return 'Bronze';
  }
  
  static async updateXP(userId, xpToAdd) {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await User.findById(userId);
        if (!user) {
          return reject(new Error('User not found'));
        }
        
        const newXP = user.xp + xpToAdd;
        const newLevel = Math.floor(newXP / 100) + 1;
        const newLeague = User.calculateLeague(newXP);
        
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
  
  // ✅ MODIFIÉ : Recherche par unique_id EXACT uniquement (pas de LIKE)
  static search(query, excludeUserId) {
    return new Promise((resolve, reject) => {
      // Si la query est exactement 10 chiffres, chercher par unique_id
      if (/^\d{10}$/.test(query)) {
        const sql = `
          SELECT id, username, level, avatar, xp, league, unique_id
          FROM users
          WHERE unique_id = ? AND id != ?
        `;
        
        db.get(sql, [query, excludeUserId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? [row] : []);
        });
      } else {
        // Sinon, pas de résultat (on ne cherche plus par nom)
        resolve([]);
      }
    });
  }
  
  // ✅ NOUVEAU : Rechercher dans ses propres amis par nom
  static searchFriends(userId, query) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.id, u.username, u.level, u.avatar, u.xp, u.league, u.unique_id
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'accepted' AND u.username LIKE ?
        ORDER BY u.username
        LIMIT 20
      `;
      
      db.all(sql, [userId, `%${query}%`], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  static getLeagueLeaderboard(league, limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, xp, level, avatar, wins, streak, unique_id
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
  
  static getGlobalLeaderboard(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, xp, level, avatar, wins, streak, league, unique_id
        FROM users
        ORDER BY xp DESC
        LIMIT ?
      `;
      
      db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else {
          const rankedRows = rows.map((row, index) => ({
            ...row,
            rank: index + 1
          }));
          resolve(rankedRows);
        }
      });
    });
  }
  
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