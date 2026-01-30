const db = require('./database');

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table WITH email verification columns
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          xp INTEGER DEFAULT 0,
          level INTEGER DEFAULT 1,
          avatar TEXT,
          wins INTEGER DEFAULT 0,
          streak INTEGER DEFAULT 0,
          league TEXT DEFAULT 'Bronze I',
          email_verified INTEGER DEFAULT 0,
          verification_code TEXT,
          verification_code_expires DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Games table
      db.run(`
        CREATE TABLE IF NOT EXISTS games (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          grid TEXT NOT NULL,
          solution TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          mode TEXT NOT NULL,
          status TEXT DEFAULT 'in_progress',
          time_elapsed INTEGER DEFAULT 0,
          mistakes INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      // Tournaments table
      db.run(`
        CREATE TABLE IF NOT EXISTS tournaments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          grid TEXT NOT NULL,
          solution TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Tournament participations table
      db.run(`
        CREATE TABLE IF NOT EXISTS tournament_participations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tournament_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          score INTEGER DEFAULT 0,
          time INTEGER DEFAULT 0,
          rank INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(tournament_id, user_id)
        )
      `);
      
      // Duels table
      db.run(`
        CREATE TABLE IF NOT EXISTS duels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player1_id INTEGER NOT NULL,
          player2_id INTEGER,
          grid TEXT NOT NULL,
          solution TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          winner_id INTEGER,
          status TEXT DEFAULT 'waiting',
          player1_progress INTEGER DEFAULT 0,
          player2_progress INTEGER DEFAULT 0,
          player1_mistakes INTEGER DEFAULT 0,
          player2_mistakes INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      
      // Boosters table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_boosters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          booster_type TEXT NOT NULL,
          quantity INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, booster_type)
        )
      `);
      
      // Friendships table
      db.run(`
        CREATE TABLE IF NOT EXISTS friendships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          friend_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, friend_id)
        )
      `);
      
      // Leaderboards table
      db.run(`
        CREATE TABLE IF NOT EXISTS leaderboards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          league TEXT NOT NULL,
          points INTEGER DEFAULT 0,
          week INTEGER NOT NULL,
          year INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, week, year)
        )
      `);
      
      // Story chapters table
      db.run(`
        CREATE TABLE IF NOT EXISTS story_chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapter_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          grid TEXT NOT NULL,
          solution TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          chapter_order INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Story progress table
      db.run(`
        CREATE TABLE IF NOT EXISTS story_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          chapter_id INTEGER NOT NULL,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, chapter_id)
        )
      `);

      // ==========================================
      // CHAT TABLES - NOUVEAU
      // ==========================================

      // Conversations table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user1_id INTEGER NOT NULL,
          user2_id INTEGER NOT NULL,
          last_message_id INTEGER,
          last_message_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user1_id, user2_id)
        )
      `);

      // Messages table
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          sender_id INTEGER NOT NULL,
          receiver_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Index pour performance
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation 
        ON messages(conversation_id, created_at DESC)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread 
        ON messages(receiver_id, is_read)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating tables:', err);
          reject(err);
        } else {
          console.log('✅ Database tables created successfully (including chat tables)');
          resolve();
        }
      });
    });
  });
};

if (require.main === module) {
  createTables()
    .then(() => {
      console.log('✅ Database initialization complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = createTables;