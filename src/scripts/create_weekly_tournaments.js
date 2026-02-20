// ==========================================
// Script: Créer 4 tournois hebdomadaires
// ==========================================
// Usage: node create_weekly_tournaments.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateSudoku } = require('../src/services/sudokuGenerator');

const dbPath = path.join(__dirname, '../database.sqlite');

console.log('📂 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur connexion à la base de données:', err);
    process.exit(1);
  }
  console.log('✅ Connecté à la base de données');
});

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

// Dates: Dimanche prochain → Dimanche suivant (7 jours)
const now = new Date();
const nextSunday = new Date(now);
nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7)); // Prochain dimanche
nextSunday.setHours(0, 0, 0, 0); // Minuit

const endDate = new Date(nextSunday);
endDate.setDate(endDate.getDate() + 7); // 7 jours après

console.log('\n🗓️ Dates des tournois:');
console.log('   Début:', nextSunday.toISOString());
console.log('   Fin:', endDate.toISOString());
console.log('   Durée: 7 jours\n');

// Supprimer les anciens tournois de cette semaine
db.run('DELETE FROM tournaments WHERE status = "active"', (err) => {
  if (err) {
    console.error('❌ Erreur suppression anciens tournois:', err);
  } else {
    console.log('🗑️ Anciens tournois supprimés\n');
  }
  
  // Créer les 4 tournois
  createTournaments(0);
});

function createTournaments(index) {
  if (index >= tournaments.length) {
    console.log('\n✅ TOUS LES TOURNOIS ONT ÉTÉ CRÉÉS !');
    console.log('\n🎯 Les joueurs peuvent maintenant participer aux tournois !');
    db.close();
    process.exit(0);
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
      nextSunday.toISOString(),
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
      createTournaments(index + 1);
    }
  );
}