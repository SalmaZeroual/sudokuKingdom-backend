const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuthenticate } = require('../middlewares/adminAuth');

// ── Auth (publique) ──────────────────────────
router.post('/login', adminController.login);

// ── Tout le reste nécessite une session admin ─
router.use(adminAuthenticate);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);

router.get('/announcements', adminController.getAnnouncements);
router.post('/announcements', adminController.createAnnouncement);
router.delete('/announcements/:id', adminController.deleteAnnouncement);

router.get('/bug-reports', adminController.getBugReports);
router.patch('/bug-reports/:id', adminController.updateBugReportStatus);

module.exports = router;