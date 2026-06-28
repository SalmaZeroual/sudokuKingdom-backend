const jwt = require('jsonwebtoken');
const db = require('../config/database');

// ══════════════════════════════════════════════
// MIGRATION DOUCE : crée les tables si besoin (même principe que le reste
// du backend : idempotent, ignore l'erreur si déjà existant).
// ══════════════════════════════════════════════
let _ensured = false;
function ensureAdminSchema() {
  if (_ensured) return Promise.resolve();
  _ensured = true;
  return new Promise((resolve) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      db.run(`
        CREATE TABLE IF NOT EXISTS bug_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          email TEXT,
          description TEXT NOT NULL,
          status TEXT DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, () => {
        db.run(`
          CREATE TABLE IF NOT EXISTS device_installs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE NOT NULL,
            platform TEXT,
            app_version TEXT,
            user_id INTEGER,
            first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, () => {
          db.run('ALTER TABLE users ADD COLUMN last_seen DATETIME', () => resolve());
        });
      });
    });
  });
}

// Petit helper pour transformer db.all/db.get en promesses sans changer
// le reste du style (callback) du backend.
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

// ══════════════════════════════════════════════
// AUTH ADMIN
// ══════════════════════════════════════════════

// ⚠️ Identifiants admin définis via variables d'environnement.
// À CHANGER avant mise en production : ADMIN_EMAIL / ADMIN_PASSWORD dans .env
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sudokukingdom.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ success: true, token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// STATISTIQUES DU DASHBOARD
// ══════════════════════════════════════════════

exports.getStats = async (req, res) => {
  try {
    await ensureAdminSchema();

    const [
      totalUsers,
      activeToday,
      active7d,
      active30d,
      totalGamesPlayed,
      totalGamesCompleted,
      totalDuels,
      totalTournamentParticipations,
      totalInstalls,
      signupsLast14Days,
      openBugReports,
    ] = await Promise.all([
      get('SELECT COUNT(*) as count FROM users'),
      get("SELECT COUNT(*) as count FROM users WHERE last_seen >= datetime('now', '-1 day')"),
      get("SELECT COUNT(*) as count FROM users WHERE last_seen >= datetime('now', '-7 days')"),
      get("SELECT COUNT(*) as count FROM users WHERE last_seen >= datetime('now', '-30 days')"),
      get('SELECT COUNT(*) as count FROM games'),
      get("SELECT COUNT(*) as count FROM games WHERE status = 'completed'"),
      get('SELECT COUNT(*) as count FROM duels'),
      get('SELECT COUNT(*) as count FROM tournament_participations'),
      get('SELECT COUNT(*) as count FROM device_installs'),
      all(`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM users
        WHERE created_at >= datetime('now', '-14 days')
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),
      get("SELECT COUNT(*) as count FROM bug_reports WHERE status = 'open'"),
    ]);

    res.json({
      total_users: totalUsers.count,
      active_today: activeToday.count,
      active_7d: active7d.count,
      active_30d: active30d.count,
      total_games_played: totalGamesPlayed.count,
      total_games_completed: totalGamesCompleted.count,
      total_duels: totalDuels.count,
      total_tournament_participations: totalTournamentParticipations.count,
      total_installs: totalInstalls.count,
      open_bug_reports: openBugReports.count,
      signups_last_14_days: signupsLast14Days, // [{day, count}, ...]
    });
  } catch (error) {
    console.error('Admin getStats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Liste paginée des utilisateurs (recherche simple par nom/email)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const where = search ? 'WHERE username LIKE ? OR email LIKE ?' : '';
    const params = search ? [`%${search}%`, `%${search}%`] : [];

    const users = await all(
      `SELECT id, username, email, level, xp, league, wins, streak, created_at, last_seen
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await get(`SELECT COUNT(*) as count FROM users ${where}`, params);

    res.json({ users, total: totalRow.count, page, limit });
  } catch (error) {
    console.error('Admin getUsers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// ANNONCES (diffusion à sens unique — pas de réponse possible)
// ══════════════════════════════════════════════

exports.getAnnouncements = async (req, res) => {
  try {
    await ensureAdminSchema();
    const announcements = await all('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50');
    res.json(announcements);
  } catch (error) {
    console.error('Admin getAnnouncements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    await ensureAdminSchema();
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'title et message sont requis' });
    }

    const result = await run(
      'INSERT INTO announcements (title, message) VALUES (?, ?)',
      [title.trim(), message.trim()]
    );

    // Envoyer le message à tous les utilisateurs via le chat (sender = Sudoku Kingdom id=999)
    const fullMessage = `📣 ${title.trim()}\n\n${message.trim()}`;
    await _broadcastMessageToAllUsers(fullMessage);

    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Admin createAnnouncement error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    await run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin deleteAnnouncement error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Endpoint PUBLIC (authentifié utilisateur, pas admin) : permet à l'app
// mobile d'afficher la dernière annonce, en lecture seule (aucune réponse
// possible, conformément à la demande : diffusion à sens unique).
exports.getLatestAnnouncementForApp = async (req, res) => {
  try {
    await ensureAdminSchema();
    const announcement = await get('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 1');
    res.json(announcement || null);
  } catch (error) {
    console.error('getLatestAnnouncementForApp error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// BUG REPORTS (visibles dans le dashboard, en plus de l'email déjà envoyé)
// ══════════════════════════════════════════════

exports.getBugReports = async (req, res) => {
  try {
    await ensureAdminSchema();
    const status = req.query.status; // 'open' | 'resolved' | undefined (tous)
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];

    const reports = await all(
      `SELECT * FROM bug_reports ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json(reports);
  } catch (error) {
    console.error('Admin getBugReports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateBugReportStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'open' | 'resolved'
    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ error: "status doit être 'open' ou 'resolved'" });
    }
    await run('UPDATE bug_reports SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin updateBugReportStatus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.ensureAdminSchema = ensureAdminSchema;

// Broadcast: envoie un vrai message de Sudoku Kingdom (id=999) à chaque utilisateur
async function _broadcastMessageToAllUsers(content) {
  const BOT_ID = 999;
  const users = await all('SELECT id FROM users WHERE id != ?', [BOT_ID]);

  for (const user of users) {
    try {
      let conv = await get(
        `SELECT id FROM conversations
         WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
        [BOT_ID, user.id, user.id, BOT_ID]
      );

      if (!conv) {
        const r = await run(
          'INSERT OR IGNORE INTO conversations (user1_id, user2_id) VALUES (?, ?)',
          [BOT_ID, user.id]
        );
        conv = { id: r.lastID };
      }

      const msgRes = await run(
        'INSERT INTO messages (conversation_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
        [conv.id, BOT_ID, user.id, content]
      );

      await run(
        'UPDATE conversations SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
        [msgRes.lastID, conv.id]
      );
    } catch (err) {
      console.error(`Broadcast failed for user ${user.id}:`, err.message);
    }
  }
}