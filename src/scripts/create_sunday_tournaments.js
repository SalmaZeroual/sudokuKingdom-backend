// ==========================================
// Script: Créer 4 tournois du DIMANCHE
// ==========================================
// Usage: node create_sunday_tournaments.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateSudoku } = require('../services/sudokuGenerator');

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');

console.log('📂 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur connexion à la base de données:', err);
    process.exit(1);
  }
  console.log('✅ Connecté à la base de données');
});

// ✅ Vérifier si on est dimanche
const now = new Date();
const dayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi, etc.

console.log('\n📅 Date actuelle:', now.toLocaleString('fr-FR'));
console.log('📅 Jour de la semaine:', dayOfWeek === 0 ? 'Dimanche ✅' : `${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayOfWeek]} ❌`);

if (dayOfWeek !== 0) {
  console.log('\n⚠️  ATTENTION: Nous ne sommes pas dimanche !');
  console.log('   Les tournois sont uniquement disponibles le dimanche.');
  console.log('   Voulez-vous quand même créer les tournois pour test ? (y/N)');
  
  // Pour l'instant, on continue quand même pour permettre les tests
  console.log('   → Création forcée des tournois pour test...\n');
}

// Configuration des 4 tournois (un par difficulté)
const tournaments = [
  {
    name: 'Tournoi Facile',
    difficulty: 'facile',
  },
  {
    name: 'Tournoi Moyen',
    difficulty: 'moyen',
  },
  {
    name: 'Tournoi Difficile',
    difficulty: 'difficile',
  },
  {
    name: 'Tournoi Extrême',
    difficulty: 'extreme',
  },
];

// ✅ Dates: AUJOURD'HUI (dimanche) 00:00 → 23:59
const startDate = new Date(now);
startDate.setHours(0, 0, 0, 0); // Début du dimanche (minuit)

const endDate = new Date(now);
endDate.setHours(23, 59, 59, 999); // Fin du dimanche (23:59:59)

console.log('\n🗓️  Dates des tournois:');
console.log('   Début:', startDate.toLocaleString('fr-FR'));
console.log('   Fin:', endDate.toLocaleString('fr-FR'));
console.log('   Durée: Aujourd\'hui uniquement (dimanche)\n');

// ✅ Supprimer les anciens tournois et participations
console.log('🗑️  Suppression des anciens tournois...');

db.serialize(() => {
  // Supprimer les participations d'abord (contrainte de clé étrangère)
  db.run('DELETE FROM tournament_participations', (err) => {
    if (err) {
      console.error('❌ Erreur suppression participations:', err);
    } else {
      console.log('   ✅ Participations supprimées');
    }
  });
  
  // Supprimer les tournois
  db.run('DELETE FROM tournaments', (err) => {
    if (err) {
      console.error('❌ Erreur suppression tournois:', err);
      db.close();
      process.exit(1);
    } else {
      console.log('   ✅ Tournois supprimés\n');
      
      // Créer les nouveaux tournois
      createTournaments(0);
    }
  });
});

function createTournaments(index) {
  if (index >= tournaments.length) {
    console.log('\n' + '='.repeat(50));
    console.log('✅ TOUS LES TOURNOIS ONT ÉTÉ CRÉÉS !');
    console.log('='.repeat(50));
    console.log('\n🎯 Les joueurs peuvent maintenant participer aux tournois !');
    console.log('📱 Ouvrez l\'application et allez dans "Tournois"\n');
    
    // Afficher un résumé
    db.all('SELECT id, name, difficulty FROM tournaments', [], (err, rows) => {
      if (!err && rows.length > 0) {
        console.log('📊 RÉSUMÉ DES TOURNOIS CRÉÉS:');
        console.log('─'.repeat(50));
        rows.forEach(row => {
          console.log(`   ${row.id}. ${row.name} (${row.difficulty})`);
        });
        console.log('─'.repeat(50) + '\n');
      }
      
      db.close();
      process.exit(0);
    });
    return;
  }
  
  const config = tournaments[index];
  
  console.log(`\n🏆 Création du tournoi ${index + 1}/4:`);
  console.log('   Nom:', config.name);
  console.log('   Difficulté:', config.difficulty);
  
  // Générer la grille
  console.log('   🎮 Génération de la grille...');
  const { grid, solution } = generateSudoku(config.difficulty);
  console.log('   ✅ Grille générée');
  
  // Créer le tournoi
  const sql = `
    INSERT INTO tournaments (
      name,
      grid,
      solution,
      difficulty,
      start_date,
      end_date,
      status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
  `;
  
  db.run(
    sql,
    [
      config.name,
      JSON.stringify(grid),
      JSON.stringify(solution),
      config.difficulty,
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    function (err) {
      if (err) {
        console.error('   ❌ Erreur:', err.message);
        db.close();
        process.exit(1);
      }
      
      console.log('   ✅ Créé avec ID:', this.lastID);
      
      // Créer le tournoi suivant
      setTimeout(() => createTournaments(index + 1), 100);
    }
  );
}