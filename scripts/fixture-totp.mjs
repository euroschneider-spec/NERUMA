// Authenticator codes (RFC 6238: 6 digits, 30 seconds, SHA-1) for the test fixture and the tests that sign in with it.
// Run it to print the current code of the platform administrators (owner3 and admin.second), or of owner.cluj:
//   node scripts/fixture-totp.mjs
//   node scripts/fixture-totp.mjs owner
import { createHmac, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Test-only key of owner3@example.test, the fixture's platform administrator. Never used anywhere real.
export const FIXTURE_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
// Test-only key of owner.cluj@example.test in the synthetic data (an owner who has two-factor set up).
export const FIXTURE_OWNER_TOTP_SECRET = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const newSecret = () => [...randomBytes(20)].map(byte => alphabet[byte % 32]).join('');

function decode(secret) {
  let bits = '';
  for (const char of secret.replace(/[\s=]/g, '').toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('Invalid base32 key');
    bits += value.toString(2).padStart(5, '0');
  }
  return Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
}

export function totp(secret, time = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const hash = createHmac('sha1', decode(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

// One step either side, as real servers allow for a phone clock that is slightly off.
export const totpMatches = (secret, code, time = Date.now()) => [-30000, 0, 30000].some(shift => totp(secret, time + shift) === code);

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) console.log(totp(process.argv[2] === 'owner' ? FIXTURE_OWNER_TOTP_SECRET : FIXTURE_ADMIN_TOTP_SECRET));
