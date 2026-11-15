const crypto = require('node:crypto');
const pass = process.argv[2];
if (!pass) { console.error('Pemakaian: npm run hash-password -- "kata-sandi-anda"'); process.exit(1); }
const salt = crypto.randomBytes(16);
console.log('ADMIN_PASSWORD_HASH=scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pass, salt, 32).toString('hex'));
