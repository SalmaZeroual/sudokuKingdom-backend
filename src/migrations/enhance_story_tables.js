const db = require('../config/database');

/**
 * Migration pour améliorer le Mode Énigme avec :
 * - Royaumes (kingdoms)
 * - Système d'étoiles (stars)
 * - Artefacts collectibles
 * - Statistiques avancées
 */

const enhanceStoryTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🚀 Starting story tables enhancement...');
      
      // ==========================================
      // 1. DROP old tables (si elles existent)
      // ==========================================
      
      db.run('DROP TABLE IF EXISTS story_progress', (err) => {
        if (err) console.error('Error dropping old story_progress:', err);
      });
      
      db.run('DROP TABLE IF EXISTS story_chapters', (err) => {
        if (err) console.error('Error dropping old story_chapters:', err);
      });
      
      // ==========================================
      // 2. CREATE new story_chapters table
      // ==========================================
      
      db.run(`
        CREATE TABLE IF NOT EXISTS story_chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kingdom_id INTEGER NOT NULL,
          chapter_id INTEGER NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          grid TEXT NOT NULL,
          solution TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          chapter_order INTEGER NOT NULL,
          story_text TEXT,
          objective_text TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating story_chapters:', err);
        } else {
          console.log('✅ Table story_chapters created');
        }
      });
      
      // ==========================================
      // 3. CREATE new story_progress table
      // ==========================================
      
      db.run(`
        CREATE TABLE IF NOT EXISTS story_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          chapter_id INTEGER NOT NULL,
          stars INTEGER DEFAULT 1,
          time_taken INTEGER DEFAULT 0,
          mistakes INTEGER DEFAULT 0,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (chapter_id) REFERENCES story_chapters(id) ON DELETE CASCADE,
          UNIQUE(user_id, chapter_id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating story_progress:', err);
        } else {
          console.log('✅ Table story_progress created');
        }
      });
      
      // ==========================================
      // 4. CREATE story_artifacts table (NOUVEAU)
      // ==========================================
      
      db.run(`
        CREATE TABLE IF NOT EXISTS story_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          artifact_id INTEGER NOT NULL,
          collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, artifact_id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating story_artifacts:', err);
        } else {
          console.log('✅ Table story_artifacts created');
        }
      });
      
      // ==========================================
      // 5. CREATE indexes for performance
      // ==========================================
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_story_chapters_kingdom 
        ON story_chapters(kingdom_id, chapter_order)
      `);
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_story_progress_user 
        ON story_progress(user_id, completed_at DESC)
      `);
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_story_artifacts_user 
        ON story_artifacts(user_id)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating indexes:', err);
          reject(err);
        } else {
          console.log('✅ Indexes created');
          console.log('🎉 Story tables enhancement completed successfully!');
          resolve();
        }
      });
    });
  });
};

// Run migration if called directly
if (require.main === module) {
  enhanceStoryTables()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = enhanceStoryTables;