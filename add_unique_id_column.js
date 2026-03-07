const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ✅ CORRIGÉ : database.sqlite est dans le même dossier que ce script
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('📂 Chemin de la base:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to SQLite:', err);
    process.exit(-1);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

db.serialize(() => {
  console.log('🔧 Vérification de la colonne unique_id...');
  
  // Vérifier si la colonne existe déjà
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
      console.error('❌ Erreur:', err);
      db.close();
      process.exit(-1);
    }
    
    const hasUniqueId = rows.some(row => row.name === 'unique_id');
    
    if (hasUniqueId) {
      console.log('✅ La colonne unique_id existe déjà !');
      
      // Créer l'index unique si pas encore fait
      db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id)', (err) => {
        if (err) {
          console.error('⚠️  Index déjà présent ou erreur:', err.message);
        } else {
          console.log('✅ Index unique créé !');
        }
        
        console.log('');
        console.log('🎉 Configuration terminée !');
        console.log('👉 Maintenant lance: node migrate_unique_ids.js');
        db.close();
      });
      return;
    }
    
    // Ajouter la colonne SANS contrainte UNIQUE
    console.log('➕ Ajout de la colonne unique_id...');
    db.run('ALTER TABLE users ADD COLUMN unique_id TEXT', (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'ajout de la colonne:', err);
        db.close();
        process.exit(-1);
      }
      
      console.log('✅ Colonne unique_id ajoutée !');
      
      // Créer un index UNIQUE
      console.log('🔧 Création de l\'index unique...');
      db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id)', (err) => {
        if (err) {
          console.error('❌ Erreur lors de la création de l\'index:', err);
          db.close();
          process.exit(-1);
        }
        
        console.log('✅ Index unique créé !');
        console.log('');
        console.log('🎉 Migration terminée avec succès !');
        console.log('👉 Maintenant lance: node migrate_unique_ids.js');
        
        db.close();
      });
    });
  });
});