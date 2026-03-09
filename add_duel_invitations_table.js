const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Adding duel_invitations table...');

db.serialize(() => {
  // Create duel_invitations table
  db.run(`
    CREATE TABLE IF NOT EXISTS duel_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err);
    } else {
      console.log('✅ Table duel_invitations created');
    }
  });

  // Create indexes
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_duel_invitations_to_user 
    ON duel_invitations(to_user_id, status)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating index idx_duel_invitations_to_user:', err);
    } else {
      console.log('✅ Index idx_duel_invitations_to_user created');
    }
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_duel_invitations_from_user 
    ON duel_invitations(from_user_id, status)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating index idx_duel_invitations_from_user:', err);
    } else {
      console.log('✅ Index idx_duel_invitations_from_user created');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('❌ Error closing database:', err);
  } else {
    console.log('✅ Migration completed successfully!');
  }
});