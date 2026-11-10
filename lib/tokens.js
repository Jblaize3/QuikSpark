import crypto from 'crypto';

// Reset and confirmation links carry a random token. Only its hash is stored, so
// reading the database never reveals a working link.
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export function newToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
