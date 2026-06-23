// ==========================================
// dailyTournamentJob.js
// Planificateur cron — exécuté au démarrage du backend
// Crée les 4 tournois quotidiens à minuit chaque jour
// ==========================================
// Installation requise : npm install node-cron
// ==========================================

const cron = require('node-cron');
const Tournament = require('../models/Tournament');
const { generateSudoku } = require('../services/sudokuGenerator');

/**
 * Crée les 4 tournois du jour (facile / moyen / difficile / extrême)
 * si ils n'ont pas encore été créés pour aujourd'hui.
 */
async function createDailyTournaments() {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  console.log('\n🌅 [CRON] Vérification des tournois quotidiens...');
  console.log(`   Date : ${now.toLocaleDateString('fr-FR')}`);

  // Vérifier si des tournois existent déjà pour aujourd'hui
  const existing = await Tournament.getActiveTournaments();

  if (existing.length > 0) {
    const firstStart = new Date(existing[0].start_date);
    if (firstStart.toDateString() === startOfDay.toDateString()) {
      console.log('   ✅ Tournois déjà créés pour aujourd\'hui, rien à faire.\n');
      return;
    }
  }

  // Créer les 4 tournois
  console.log('   🏆 Création des 4 tournois du jour...');

  const configs = [
    { name: 'Tournoi Quotidien — Facile',    difficulty: 'facile'    },
    { name: 'Tournoi Quotidien — Moyen',     difficulty: 'moyen'     },
    { name: 'Tournoi Quotidien — Difficile', difficulty: 'difficile' },
    { name: 'Tournoi Quotidien — Extrême',   difficulty: 'extreme'   },
  ];

  for (const config of configs) {
    try {
      const { grid, solution } = generateSudoku(config.difficulty);

      await Tournament.create({
        name: config.name,
        grid,
        solution,
        difficulty: config.difficulty,
        startDate: startOfDay,
        endDate: endOfDay,
      });

      console.log(`   ✅ ${config.name}`);
    } catch (err) {
      console.error(`   ❌ Erreur ${config.name} :`, err.message);
    }
  }

  console.log('   🎉 Tournois quotidiens créés avec succès !\n');
}

/**
 * Initialise le cron job.
 * Appeler cette fonction dans app.js / server.js au démarrage.
 *
 * Planification : chaque jour à 00:00:00 (minuit)
 */
function initDailyTournamentJob() {
  // Lancer immédiatement au démarrage du serveur pour le jour courant
  createDailyTournaments().catch(console.error);

  // Puis relancer chaque jour à minuit
  // Format cron : seconde minute heure jour mois jourSemaine
  cron.schedule('0 0 * * *', () => {
    console.log('\n⏰ [CRON] Minuit — Génération des nouveaux tournois du jour...');
    createDailyTournaments().catch(console.error);
  }, {
    timezone: 'Africa/Casablanca', // 🇲🇦 Fuseau horaire Maroc — adapte si besoin
  });

  console.log('⏰ [CRON] Job de tournois quotidiens planifié (00:00 chaque jour)');
}

module.exports = { initDailyTournamentJob, createDailyTournaments };