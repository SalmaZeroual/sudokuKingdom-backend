const db = require('../config/database');

class TournamentParticipation {

  // Créer une participation
  static create(userId, tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tournament_participations (user_id, tournament_id, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;
      db.run(sql, [userId, tournamentId], function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, userId, tournamentId });
      });
    });
  }

  // Trouver une participation par user + tournoi
  static findByUserAndTournament(userId, tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tournament_participations
        WHERE user_id = ? AND tournament_id = ?
      `;
      db.get(sql, [userId, tournamentId], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  // Mettre à jour le score
  // ✅ Correction : suppression de "completed_at" qui n'existe pas dans le schéma
  static updateScore(participationId, score, time) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE tournament_participations
        SET score = ?, time = ?
        WHERE id = ?
      `;
      db.run(sql, [score, time, participationId], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  // Récupérer tous les participants d'un tournoi
  static getTournamentParticipants(tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tournament_participations WHERE tournament_id = ?
      `;
      db.all(sql, [tournamentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getLeaderboard(tournamentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          tp.id, tp.tournament_id, tp.user_id,
          tp.score, tp.time, u.username,
          ROW_NUMBER() OVER (ORDER BY tp.score DESC, tp.time ASC) as rank
        FROM tournament_participations tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
          AND tp.score > 0
        ORDER BY tp.score DESC, tp.time ASC
        LIMIT 100
      `;
      db.all(sql, [tournamentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getFriendsLeaderboard(tournamentId, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          tp.id, tp.tournament_id, tp.user_id,
          tp.score, tp.time, u.username,
          ROW_NUMBER() OVER (ORDER BY tp.score DESC, tp.time ASC) as rank
        FROM tournament_participations tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
          AND tp.score > 0
          AND (
            tp.user_id = ?
            OR tp.user_id IN (
              SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
              FROM friendships
              WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'
            )
          )
        ORDER BY tp.score DESC, tp.time ASC
        LIMIT 100
      `;
      db.all(sql, [tournamentId, userId, userId, userId, userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Participations de l'utilisateur (historique)
  static getUserParticipations(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT tp.*, t.name, t.difficulty, t.start_date, t.end_date
        FROM tournament_participations tp
        JOIN tournaments t ON tp.tournament_id = t.id
        WHERE tp.user_id = ?
        ORDER BY tp.created_at DESC
      `;
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = TournamentParticipation;