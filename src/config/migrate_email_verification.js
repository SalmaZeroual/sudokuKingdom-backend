const db = require('./database');

console.log('🔄 Migration: Adding email verification columns...\n');

db.serialize(() => {
  // Add email_verified column
  db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✅ Column email_verified already exists');
      } else {
        console.error('❌ Error adding email_verified:', err.message);
      }
    } else {
      console.log('✅ Column email_verified added');
    }
  });

  // Add verification_code column
  db.run(`ALTER TABLE users ADD COLUMN verification_code TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✅ Column verification_code already exists');
      } else {
        console.error('❌ Error adding verification_code:', err.message);
      }
    } else {
      console.log('✅ Column verification_code added');
    }
  });

  // Add verification_code_expires column
  db.run(`ALTER TABLE users ADD COLUMN verification_code_expires DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✅ Column verification_code_expires already exists');
      } else {
        console.error('❌ Error adding verification_code_expires:', err.message);
      }
    } else {
      console.log('✅ Column verification_code_expires added');
    }
    
    console.log('\n✅ Migration completed!');
    console.log('You can now restart your server.\n');
    process.exit(0);
  });
});