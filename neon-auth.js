// jose v6 is ESM-only; load it lazily with import() so a plain require() of this file never crashes
// the serverless function at startup (ERR_REQUIRE_ESM).
let josePromise;
const loadJose = () => (josePromise = josePromise || import('jose'));
const cfg = require('./config');

let jwks;

async function verifyNeonToken(token) {
  if (!cfg.NEON_AUTH_BASE_URL || !cfg.NEON_AUTH_JWKS_URL) {
    const error = new Error('Neon Auth is not configured.');
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  const { createRemoteJWKSet, jwtVerify } = await loadJose();
  if (!jwks) jwks = createRemoteJWKSet(new URL(cfg.NEON_AUTH_JWKS_URL));
  const result = await jwtVerify(token, jwks, {
    issuer: new URL(cfg.NEON_AUTH_BASE_URL).origin,
    algorithms: ['EdDSA'],
  });
  return result.payload;
}

module.exports = { verifyNeonToken };
