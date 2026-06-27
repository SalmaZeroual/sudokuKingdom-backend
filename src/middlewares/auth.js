const jwt = require('jsonwebtoken');
const db = require('../config/database');

// ✅ Migration douce (comme discoverability/accepts_messages) : ajoute la
// colonne si besoin, ignore l'erreur si elle existe déjà.
let _lastSeenColumnEnsured = false;
function ensureLastSeenColumn() {
  if (_lastSeenColumnEnsured) return;
  _lastSeenColumnEnsured = true;
  db.run('ALTER TABLE users ADD COLUMN last_seen DATETIME', () => {});
}

// ✅ Réactivé : utilisé par le dashboard admin pour les statistiques
// "utilisateurs actifs" (aujourd'hui / 7 jours / 30 jours). Fire-and-forget :
// ne bloque jamais la requête en cours, et n'échoue jamais bruyamment.
function updateLastSeen(userId) {
  ensureLastSeenColumn();
  db.run(
    'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
    [userId],
    () => {} // on ignore silencieusement toute erreur (non bloquant)
  );
}

exports.authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user ID to request
    req.userId = decoded.userId;

    updateLastSeen(decoded.userId);

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Invalid token' });
  }
};
// ✅ Middleware optionnel : définit req.userId si le token est valide,
// mais laisse passer même sans token (pour les routes semi-publiques).
exports.optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      updateLastSeen(decoded.userId);
    }
  } catch (_) {
    // Token invalide ou absent → pas d'userId, on continue quand même
  }
  next();
};