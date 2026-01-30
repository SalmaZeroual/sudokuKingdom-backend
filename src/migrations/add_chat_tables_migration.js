// backend/src/migrations/add_chat_tables.js

const db = require('../config/database');

const addChatTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Table des conversations
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creating conversations table:', err);
          reject(err);
          return;
        }
        console.log('✅ Table conversations created');
      });

      // Table des messages
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creating messages table:', err);
          reject(err);
          return;
        }
        console.log('✅ Table messages created');
      });

      // Index pour améliorer les performances
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation 
        ON messages(conversation_id, created_at DESC)
      `, (err) => {
        if (err) console.error('⚠️ Warning creating index:', err);
        else console.log('✅ Index idx_messages_conversation created');
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread 
        ON messages(receiver_id, is_read)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating indexes:', err);
          reject(err);
        } else {
          console.log('✅ Index idx_messages_receiver_unread created');
          console.log('🎉 Chat tables migration completed successfully!');
          resolve();
        }
      });
    });
  });
};

// Run migration if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting chat tables migration...');
  
  addChatTables()
    .then(() => {
      console.log('✅ Chat migration complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Chat migration failed:', err);
      process.exit(1);
    });
}

module.exports = addChatTables;