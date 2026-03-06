const db = require('./src/config/database');

db.all("PRAGMA table_info(users)", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Users table columns:');
    rows.forEach(row => {
      console.log(`${row.name}: ${row.type} ${row.pk ? 'PRIMARY KEY' : ''} ${row.notnull ? 'NOT NULL' : ''}`);
    });
  }
  db.close();
});