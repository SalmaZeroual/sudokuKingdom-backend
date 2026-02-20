// ==========================================
// Script pour créer l'utilisateur BOT "amitest"
// ==========================================
// Usage: node create_bot.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

console.log('📂 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur connexion à la base de données:', err);
    process.exit(1);
  }
  console.log('✅ Connecté à la base de données');
});

// Supprimer le bot s'il existe déjà
db.run('DELETE FROM users WHERE id = 999', (err) => {
  if (err) {
    console.error('⚠️ Erreur lors de la suppression:', err.message);
  } else {
    console.log('🗑️ Bot existant supprimé (s\'il existait)');
  }
  
  // Créer le bot
  const sql = `
    INSERT INTO users (
      id, 
      username, 
      email, 
      password_hash, 
      xp, 
      level, 
      avatar, 
      wins, 
      streak, 
      league, 
      email_verified, 
      created_at
    ) VALUES (
      999,
      'amitest',
      'bot@sudokukingdom.com',
      '$2a$10$FAKE.HASH.BOT.CANNOT.LOGIN.WITH.THIS.HASH.AT.ALL',
      5000,
      25,
      '🤖',
      150,
      0,
      'Diamond',
      1,
      CURRENT_TIMESTAMP
    )
  `;
  
  db.run(sql, (err) => {
    if (err) {
      console.error('❌ Erreur lors de la création du bot:', err.message);
      process.exit(1);
    }
    
    console.log('✅ Bot "amitest" créé avec succès !');
    console.log('');
    console.log('📊 Informations du bot:');
    console.log('   ID: 999');
    console.log('   Username: amitest');
    console.log('   Email: bot@sudokukingdom.com');
    console.log('   Level: 25');
    console.log('   League: Diamond');
    console.log('   XP: 5000');
    console.log('   Avatar: 🤖');
    console.log('');
    console.log('🎮 Tu peux maintenant chercher un duel et "amitest" apparaîtra automatiquement !');
    
    // Vérifier que le bot existe
    db.get('SELECT * FROM users WHERE id = 999', (err, row) => {
      if (err) {
        console.error('❌ Erreur vérification:', err.message);
      } else if (row) {
        console.log('');
        console.log('✅ Vérification: Le bot existe bien en base de données');
        console.log('   Username:', row.username);
        console.log('   Level:', row.level);
      } else {
        console.log('❌ Le bot n\'a pas été créé correctement');
      }
      
      db.close();
      process.exit(0);
    });
  });
});