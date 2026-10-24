const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY  = process.env.JWT_ACCESS_EXPIRY  || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets não configurados. Verifique o .env');
}

/**
 * Gera um access token de curta duração
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

/**
 * Gera um refresh token de longa duração
 */
// `jti` aleatório: o JWT só muda a cada segundo (iat). Dois logins do mesmo
// usuário no mesmo segundo (duplo clique, duas pessoas no "entrar como
// médica") gerariam o mesmo token e estourariam o @unique de RefreshToken.
const generateRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

/**
 * Verifica e decodifica um access token
 */
const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);

/**
 * Verifica e decodifica um refresh token
 */
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
