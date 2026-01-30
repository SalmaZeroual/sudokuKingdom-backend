const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email service error:', error);
  } else {
    console.log('✅ Email service ready');
  }
});

// ==========================================
// FUNCTION DECLARATIONS
// ==========================================

// Generate 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, username, code) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '🏰 Vérification de votre compte Sudoku Kingdom',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #3B82F6, #8B5CF6);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 40px 30px;
            }
            .code-box {
              background-color: #F3F4F6;
              border: 2px dashed #3B82F6;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #3B82F6;
              letter-spacing: 8px;
            }
            .footer {
              background-color: #F9FAFB;
              padding: 20px;
              text-align: center;
              color: #6B7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏰 Sudoku Kingdom</h1>
              <p>Vérification de votre compte</p>
            </div>
            <div class="content">
              <h2>Bienvenue ${username} !</h2>
              <p>Merci de vous être inscrit sur Sudoku Kingdom. Pour activer votre compte, veuillez utiliser le code de vérification ci-dessous :</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p>Ce code est valide pendant <strong>10 minutes</strong>.</p>
              
              <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
              
              <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                Si le code ne fonctionne pas, vous pouvez le copier-coller : <strong>${code}</strong>
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Sudoku Kingdom. Tous droits réservés.</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, username) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '🎉 Bienvenue sur Sudoku Kingdom !',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #10B981, #059669);
              color: white;
              padding: 40px;
              text-align: center;
            }
            .content {
              padding: 40px 30px;
            }
            .feature {
              margin: 20px 0;
              padding: 15px;
              background-color: #F3F4F6;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏰 Bienvenue sur Sudoku Kingdom !</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${username} ! 👋</h2>
              <p>Votre compte a été vérifié avec succès ! Vous pouvez maintenant profiter de toutes les fonctionnalités :</p>
              
              <div class="feature">
                <strong>🎮 Mode Classique</strong>
                <p>Progressez comme dans un RPG et débloquez des compétences</p>
              </div>
              
              <div class="feature">
                <strong>📚 Mode Énigme</strong>
                <p>Vivez une aventure épique à travers des chapitres</p>
              </div>
              
              <div class="feature">
                <strong>⚔️ Mode Duel</strong>
                <p>Affrontez d'autres joueurs en temps réel</p>
              </div>
              
              <div class="feature">
                <strong>🏆 Tournois</strong>
                <p>Participez aux compétitions et grimpez dans les classements</p>
              </div>
              
              <p style="margin-top: 30px;">Bon jeu et à bientôt dans le royaume ! 🎯</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, username, resetCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '🔐 Réinitialisation de votre mot de passe - Sudoku Kingdom',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #EF4444, #DC2626);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 40px 30px;
            }
            .code-box {
              background-color: #FEF2F2;
              border: 2px dashed #EF4444;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #EF4444;
              letter-spacing: 8px;
            }
            .warning-box {
              background-color: #FFF3CD;
              border-left: 4px solid #FFC107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              background-color: #F9FAFB;
              padding: 20px;
              text-align: center;
              color: #6B7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Réinitialisation de mot de passe</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${username},</h2>
              <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte Sudoku Kingdom.</p>
              
              <div class="code-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Votre code de réinitialisation :</p>
                <div class="code">${resetCode}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">⏰ Ce code expire dans 15 minutes</p>
              </div>
              
              <p>Entrez ce code dans l'application pour réinitialiser votre mot de passe.</p>
              
              <div class="warning-box">
                <p style="margin: 0; font-size: 13px; color: #856404;">
                  <strong>⚠️ Attention :</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet email et votre mot de passe restera inchangé.
                </p>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                Si le code ne fonctionne pas, vous pouvez le copier-coller : <strong>${resetCode}</strong>
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Sudoku Kingdom. Tous droits réservés.</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
};

// ==========================================
// EXPORTS - À LA FIN DU FICHIER
// ==========================================

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};