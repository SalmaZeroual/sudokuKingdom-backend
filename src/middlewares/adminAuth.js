const jwt = require('jsonwebtoken');

// ✅ Middleware dédié à l'admin : vérifie un JWT distinct (role: 'admin'),
// séparé des jetons utilisateurs classiques. Une session admin ne donne
// jamais accès aux routes utilisateur, et inversement.
exports.adminAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminEmail = decoded.email;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};