const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { authenticate } = require('../middlewares/auth'); // ✅ CORRIGÉ
const User = require('../models/User');

// ✅ Configuration email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// POST /api/support/report-bug
router.post('/report-bug', authenticate, async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.userId; // ✅ Fourni par le middleware authenticate

    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'La description est requise' });
    }

    // ✅ Récupérer les infos de l'utilisateur depuis la DB
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log('📧 Envoi du bug report pour:', user.username);

    // ✅ Email à envoyer
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'salma9ezeroual@gmail.com',
      subject: '🐛 Bug Report - Sudoku Kingdom',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">🐛 Nouveau Bug Signalé</h2>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Informations utilisateur :</h3>
            <p><strong>👤 Username :</strong> ${user.username}</p>
            <p><strong>📧 Email :</strong> ${user.email}</p>
            <p><strong>🆔 User ID :</strong> ${user.id}</p>
            <p><strong>📱 Niveau :</strong> ${user.level || 1}</p>
            <p><strong>🏆 Ligue :</strong> ${user.league || 'Bronze'}</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <h3 style="margin-top: 0; color: #dc2626;">Description du problème :</h3>
            <p style="white-space: pre-wrap;">${description}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 8px;">
            <p style="margin: 0; font-size: 12px; color: #1e40af;">
              📅 Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}<br>
              🌍 Fuseau horaire : Europe/Paris
            </p>
          </div>
        </div>
      `,
    };

    // ✅ Envoyer l'email
    await transporter.sendMail(mailOptions);

    console.log('✅ Bug report envoyé avec succès !');

    res.json({
      success: true,
      message: 'Bug signalé avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du rapport de bug:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'envoi du rapport',
      message: error.message,
    });
  }
});

module.exports = router;