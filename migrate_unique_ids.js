// Script de migration : Générer des unique_id pour tous les utilisateurs existants
// À exécuter UNE SEULE FOIS après avoir ajouté la colonne unique_id

const db = require('./config/database');

function generateUniqueId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

async function migrateUsers() {
  return new Promise((resolve, reject) => {
    // Récupérer tous les utilisateurs sans unique_id
    db.all('SELECT id FROM users WHERE unique_id IS NULL', [], async (err, users) => {
      if (err) {
        console.error('❌ Erreur:', err);
        reject(err);
        return;
      }

      console.log(`📊 ${users.length} utilisateurs à migrer...`);

      if (users.length === 0) {
        console.log('✅ Tous les utilisateurs ont déjà un unique_id !');
        resolve();
        return;
      }

      const usedIds = new Set();

      for (const user of users) {
        let uniqueId;
        let attempts = 0;

        // Générer un ID unique
        do {
          uniqueId = generateUniqueId();
          attempts++;
          if (attempts > 100) {
            console.error(`❌ Impossible de générer un ID unique pour l'utilisateur ${user.id}`);
            break;
          }
        } while (usedIds.has(uniqueId));

        usedIds.add(uniqueId);

        // Mettre à jour l'utilisateur
        await new Promise((res, rej) => {
          db.run(
            'UPDATE users SET unique_id = ? WHERE id = ?',
            [uniqueId, user.id],
            (err) => {
              if (err) {
                console.error(`❌ Erreur pour user ${user.id}:`, err);
                rej(err);
              } else {
                console.log(`✅ User ${user.id} → unique_id: ${uniqueId}`);
                res();
              }
            }
          );
        });
      }

      console.log('✅ Migration terminée !');
      resolve();
    });
  });
}

// Exécuter la migration
migrateUsers()
  .then(() => {
    console.log('🎉 Migration réussie !');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Erreur durant la migration:', err);
    process.exit(1);
  });