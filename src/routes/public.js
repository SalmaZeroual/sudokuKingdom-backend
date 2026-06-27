const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

// ✅ NOUVEAU : suivi des installations ("utilisateurs qui ont l'app sur le
// téléphone"). Pas d'authentification requise : appelé une fois au premier
// lancement de l'app, avant même la création d'un compte.
// Body: { device_id, platform, app_version }
router.post('/track-install', async (req, res) => {
  try {
    await adminController.ensureAdminSchema();
    const { device_id, platform, app_version } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id requis' });
    }

    db.run(
      `INSERT INTO device_installs (device_id, platform, app_version)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         last_seen_at = CURRENT_TIMESTAMP,
         app_version = excluded.app_version`,
      [device_id, platform || null, app_version || null],
      (err) => {
        if (err) {
          console.error('track-install error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ success: true });
      }
    );
  } catch (error) {
    console.error('track-install error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ NOUVEAU : lecture (utilisateur connecté) de la dernière annonce admin.
// Lecture seule — aucune route de réponse n'existe, par design.
router.get('/announcement', authenticate, adminController.getLatestAnnouncementForApp);

module.exports = router;