const jwt = require('jsonwebtoken');

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

    // ✅ COMMENTÉ : updateLastSeen nécessite la colonne last_seen dans la DB
    // Pour réactiver plus tard, ajoute la colonne : ALTER TABLE users ADD COLUMN last_seen TEXT;
    // const { updateLastSeen } = require('../controllers/socialController');
    // updateLastSeen(decoded.userId);

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Invalid token' });
  }
};