const db = require('./src/config/database');

// Execute the migration SQL
db.serialize(() => {
  db.run(`ALTER TABLE users ADD COLUMN unique_id TEXT UNIQUE`, (err) => {
    if (err) {
      console.error('Error adding column:', err);
    } else {
      console.log('✅ Column unique_id added successfully');
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id)`, (err) => {
    if (err) {
      console.error('Error creating index:', err);
    } else {
      console.log('✅ Index created successfully');
    }
  });

  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
});