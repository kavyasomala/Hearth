/**
 * Backup encryption — AES-256-GCM with a scrypt-derived key.
 *
 * Used from two places, which is why it lives here rather than in a shell step:
 *   - .github/workflows/backup.yml  encrypts the nightly dump
 *   - server.js (/api/admin/restore) decrypts it to restore
 *
 * Node's built-in crypto is deliberate: no gpg/openssl binary needs to exist on
 * the Render container. The passphrase comes from BACKUP_PASSPHRASE and must be
 * identical in GitHub Actions secrets and Render's environment.
 *
 * File layout:  salt(16) || iv(12) || authTag(16) || ciphertext
 */

const crypto = require('crypto');

const SALT_LEN = 16;
const IV_LEN   = 12;
const TAG_LEN  = 16;
const KEY_LEN  = 32;
// scrypt cost. N=2^15 keeps derivation ~100ms — slow enough to blunt brute force,
// fast enough for a once-a-day job.
const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_LEN, SCRYPT_OPTS);
}

function encrypt(plaintext, passphrase) {
  if (!passphrase) throw new Error('BACKUP_PASSPHRASE is empty');
  const salt = crypto.randomBytes(SALT_LEN);
  const iv   = crypto.randomBytes(IV_LEN);
  const key  = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), body]);
}

function decrypt(buffer, passphrase) {
  if (!passphrase) throw new Error('BACKUP_PASSPHRASE is empty');
  if (buffer.length < SALT_LEN + IV_LEN + TAG_LEN) throw new Error('Encrypted file is truncated');
  const salt = buffer.subarray(0, SALT_LEN);
  const iv   = buffer.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag  = buffer.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const body = buffer.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  // GCM verifies integrity here — a wrong passphrase or a corrupted file throws
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };

// CLI:  node backupCrypto.js encrypt|decrypt <in> <out>
if (require.main === module) {
  const fs = require('fs');
  const [mode, inFile, outFile] = process.argv.slice(2);
  const pass = process.env.BACKUP_PASSPHRASE;

  if (!['encrypt', 'decrypt'].includes(mode) || !inFile || !outFile) {
    console.error('usage: node backupCrypto.js encrypt|decrypt <in> <out>');
    process.exit(2);
  }
  if (!pass) {
    console.error('BACKUP_PASSPHRASE is not set');
    process.exit(2);
  }

  try {
    if (mode === 'encrypt') {
      fs.writeFileSync(outFile, encrypt(fs.readFileSync(inFile, 'utf8'), pass));
    } else {
      fs.writeFileSync(outFile, decrypt(fs.readFileSync(inFile), pass), 'utf8');
    }
    console.log(`${mode}ed -> ${outFile}`);
  } catch (err) {
    console.error(`${mode} failed: ${err.message}`);
    process.exit(1);
  }
}
