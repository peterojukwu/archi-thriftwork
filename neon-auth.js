const { createRemoteJWKSet, jwtVerify } = require('jose');
const cfg = require('./config');

let jwks;

async function verifyNeonToken(token) {
  if (!cfg.NEON_AUTH_BASE_URL || !cfg.NEON_AUTH_JWKS_URL) {
    const error = new Error('Neon Auth is not configured.');
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  if (!jwks) jwks = createRemoteJWKSet(new URL(cfg.NEON_AUTH_JWKS_URL));
  const result = await jwtVerify(token, jwks, {
    issuer: new URL(cfg.NEON_AUTH_BASE_URL).origin,
    algorithms: ['EdDSA'],
  });
  return result.payload;
}

module.exports = { verifyNeonToken };
