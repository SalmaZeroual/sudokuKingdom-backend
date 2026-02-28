const jwt = require('jsonwebtoken');
const { updateLastSeen } = require('../controllers/socialController');

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

    // ✅ Mettre à jour last_seen à chaque requête authentifiée
    // Permet de savoir si un user est "en ligne" (actif dans les 3 dernières minutes)
    updateLastSeen(decoded.userId);

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Invalid token' });
  }
};