const db = require('./src/config/database');

db.get("PRAGMA table_info(users)", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  console.log('Colonnes de la table users:');
  console.log(rows);
});

db.all("PRAGMA table_info(users)", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  console.log('\n📋 Colonnes de la table users:\n');
  rows.forEach(row => {
    console.log(`  - ${row.name} (${row.type})`);
  });
  
  const hasEmailVerified = rows.some(r => r.name === 'email_verified');
  const hasVerificationCode = rows.some(r => r.name === 'verification_code');
  const hasCodeExpires = rows.some(r => r.name === 'verification_code_expires');
  
  console.log('\n✅ Statut des colonnes de vérification:');
  console.log(`  email_verified: ${hasEmailVerified ? '✅' : '❌'}`);
  console.log(`  verification_code: ${hasVerificationCode ? '✅' : '❌'}`);
  console.log(`  verification_code_expires: ${hasCodeExpires ? '✅' : '❌'}`);
  
  if (hasEmailVerified && hasVerificationCode && hasCodeExpires) {
    console.log('\n🎉 Toutes les colonnes nécessaires sont présentes!');
  } else {
    console.log('\n⚠️ Certaines colonnes manquent. Lancez la migration.');
  }
  
  process.exit(0);
});