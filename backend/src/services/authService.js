const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../config/jwt');

const SALT_ROUNDS = 12;

// ─── helpers ────────────────────────────────────────────────

const buildTokenPayload = (user) => ({
  id:       user.id,
  username: user.username,
  role:     user.role,
});

const issueTokenPair = async (user) => {
  const payload      = buildTokenPayload(user);
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Persiste o refresh token
  await prisma.refreshToken.create({
    data: {
      token:     refreshToken,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7d
    },
  });

  return { accessToken, refreshToken };
};

// ─── register ───────────────────────────────────────────────
// Só paciente se cadastra (a médica já tem login pronto). O paciente novo
// fica vinculado a toda médica cadastrada: sem vínculo, o alerta da triagem
// dele não chegaria a ninguém.

const register = async ({ username, password, fullName }) => {
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) throw Object.assign(new Error('Esse usuário já existe, escolha outro'), { status: 409 });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const doctors      = await prisma.doctor.findMany({ select: { id: true } });

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'PATIENT',
      patient: {
        create: {
          fullName,
          doctorLinks: { create: doctors.map((d) => ({ doctorId: d.id })) },
        },
      },
    },
    include: { patient: true },
  });

  const tokens = await issueTokenPair(user);
  return { user: sanitize(user), ...tokens };
};

// ─── login ──────────────────────────────────────────────────

const login = async ({ username, password }) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      patient: { select: { fullName: true, healthCoins: true } },
      doctor:  { select: { fullName: true } },
    },
  });
  if (!user || !user.isActive)
    throw Object.assign(new Error('Usuário ou senha inválidos'), { status: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid)
    throw Object.assign(new Error('Usuário ou senha inválidos'), { status: 401 });

  // Log de auditoria
  await prisma.auditLog.create({
    data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id },
  });

  const tokens = await issueTokenPair(user);
  return { user: sanitize(user), ...tokens };
};

// ─── refresh ────────────────────────────────────────────────

const refresh = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw Object.assign(new Error('Refresh token inválido'), { status: 401 });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date())
    throw Object.assign(new Error('Refresh token expirado'), { status: 401 });

  // Rotação: invalida o antigo, emite novo par
  await prisma.refreshToken.delete({ where: { token } });

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive)
    throw Object.assign(new Error('Usuário inativo'), { status: 401 });

  return issueTokenPair(user);
};

// ─── logout ─────────────────────────────────────────────────

const logout = async (token, userId) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
  await prisma.auditLog.create({
    data: { userId, action: 'LOGOUT', entity: 'User', entityId: userId },
  });
};

// ─── changePassword ─────────────────────────────────────────

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid)
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Invalida todos os refresh tokens ao trocar a senha
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

// ─── tutorial ───────────────────────────────────────────────

const markTutorialSeen = (userId) =>
  prisma.user.update({ where: { id: userId }, data: { tutorialSeenAt: new Date() } });

// ─── sanitize ───────────────────────────────────────────────

const sanitize = (user) => {
  const { passwordHash, patient, doctor, ...safe } = user;
  return {
    ...safe,
    fullName:    patient?.fullName ?? doctor?.fullName ?? null,
    healthCoins: patient?.healthCoins ?? null,
  };
};

module.exports = { register, login, refresh, logout, changePassword, markTutorialSeen };
