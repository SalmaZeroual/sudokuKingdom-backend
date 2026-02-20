// ==========================================
// Script: Mettre à jour toutes les leagues
// ==========================================
// Usage: node update_all_leagues.js
// (depuis src/scripts/)

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ✅ FIX: Remonter de 2 niveaux (src/scripts/ → racine)
const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');

console.log('📂 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur connexion à la base de données:', err);
    console.log('\n💡 Vérifiez que database.sqlite existe à la racine du backend\n');
    process.exit(1);
  }
  console.log('✅ Connecté à la base de données');
});

// Fonction pour calculer la league selon les XP
function calculateLeague(xp) {
  if (xp >= 12000) return 'Legend';
  if (xp >= 8000) return 'Master';
  if (xp >= 5000) return 'Diamond';
  if (xp >= 3000) return 'Platinum';
  if (xp >= 1500) return 'Gold';
  if (xp >= 500) return 'Silver';
  return 'Bronze';
}

// Récupérer tous les utilisateurs
db.all('SELECT id, username, xp, league FROM users', [], (err, users) => {
  if (err) {
    console.error('❌ Erreur récupération utilisateurs:', err);
    console.log('\n💡 Vérifiez que :');
    console.log('   1. Le backend a été lancé au moins une fois (npm start)');
    console.log('   2. La table users existe dans database.sqlite\n');
    db.close();
    process.exit(1);
  }
  
  if (users.length === 0) {
    console.log('\n⚠️  Aucun utilisateur trouvé dans la base de données.');
    console.log('   Créez d\'abord un compte dans l\'application.\n');
    db.close();
    process.exit(0);
  }
  
  console.log(`\n📊 Mise à jour de ${users.length} utilisateur(s)...\n`);
  
  let updated = 0;
  let unchanged = 0;
  let processed = 0;
  
  users.forEach((user) => {
    const correctLeague = calculateLeague(user.xp);
    
    if (user.league !== correctLeague) {
      // Mise à jour nécessaire
      db.run(
        'UPDATE users SET league = ? WHERE id = ?',
        [correctLeague, user.id],
        (err) => {
          if (err) {
            console.error(`❌ Erreur mise à jour ${user.username}:`, err);
          } else {
            console.log(`✅ ${user.username}: ${user.xp} XP | ${user.league || 'null'} → ${correctLeague}`);
            updated++;
          }
          
          processed++;
          if (processed === users.length) {
            finishUpdate();
          }
        }
      );
    } else {
      // Déjà à jour
      console.log(`⏭️  ${user.username}: ${user.league} (déjà correct)`);
      unchanged++;
      
      processed++;
      if (processed === users.length) {
        finishUpdate();
      }
    }
  });
  
  function finishUpdate() {
    setTimeout(() => {
      console.log('\n' + '='.repeat(50));
      console.log('📈 RÉSUMÉ DE LA MISE À JOUR');
      console.log('='.repeat(50));
      console.log(`Total utilisateurs: ${users.length}`);
      console.log(`✅ Mis à jour: ${updated}`);
      console.log(`⏭️  Déjà corrects: ${unchanged}`);
      console.log('='.repeat(50) + '\n');
      
      console.log('✅ MIGRATION TERMINÉE !\n');
      
      // Afficher les stats par league
      db.all(`
        SELECT league, COUNT(*) as count 
        FROM users 
        GROUP BY league 
        ORDER BY 
          CASE league
            WHEN 'Bronze' THEN 1
            WHEN 'Silver' THEN 2
            WHEN 'Gold' THEN 3
            WHEN 'Platinum' THEN 4
            WHEN 'Diamond' THEN 5
            WHEN 'Master' THEN 6
            WHEN 'Legend' THEN 7
            ELSE 99
          END
      `, [], (err, stats) => {
        if (err) {
          console.error('Erreur stats:', err);
        } else {
          console.log('🏆 RÉPARTITION PAR LEAGUE:');
          console.log('─'.repeat(30));
          stats.forEach(s => {
            const emoji = {
              'Bronze': '🥉',
              'Silver': '🥈',
              'Gold': '🥇',
              'Platinum': '💎',
              'Diamond': '💠',
              'Master': '👑',
              'Legend': '⚡'
            }[s.league] || '📊';
            
            const bar = '█'.repeat(Math.min(s.count, 20));
            console.log(`${emoji} ${s.league.padEnd(10)}: ${s.count.toString().padStart(2)} ${bar}`);
          });
          console.log('─'.repeat(30) + '\n');
        }
        
        db.close();
        process.exit(0);
      });
    }, 1000);
  }
});