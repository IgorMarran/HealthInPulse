// ─── Personas da feira no banco (seed de verdade) ───────────────────
// O onco.personas.test.js confere o motor puro. Aqui roda o seed.js
// inteiro num SQLite temporário (com as triagens feitas pelo
// triageService) e lê o painel de risco como a médica lê
// (riskService.assessPatient): é a história que o grupo mostra no stand.
//
// Banco: pasta temporária do sistema, criada com `prisma db push` e
// apagada no fim (mesmo esquema do kb.db.test.js). O dev.db não é tocado.

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');
const { spawnSync } = require('node:child_process');

const BACKEND = path.join(__dirname, '..');

let tmpDir;
let prisma;
let riskService;

test.before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hip-seed-'));
  const url = `file:${path.join(tmpDir, 'seed.db').replace(/\\/g, '/')}`;
  // Segredos de mentira: o seed carrega o triageService (socket → jwt)
  const env = {
    ...process.env, DATABASE_URL: url, NODE_ENV: 'test', PRISMA_HIDE_UPDATE_MESSAGE: '1',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'teste-access',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'teste-refresh',
  };

  const cli = require.resolve('prisma/build/index.js', { paths: [BACKEND] });
  const push = spawnSync(process.execPath, [cli, 'db', 'push', '--skip-generate'], { cwd: BACKEND, env, encoding: 'utf8' });
  assert.equal(push.status, 0, `prisma db push falhou:\n${push.stdout}\n${push.stderr}`);

  const seed = spawnSync(process.execPath, ['src/prisma/seed.js'], { cwd: BACKEND, env, encoding: 'utf8' });
  assert.equal(seed.status, 0, `seed falhou:\n${seed.stdout}\n${seed.stderr}`);

  // Ordem importa: o env vem ANTES do require (config/database lê DATABASE_URL ao carregar)
  Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test' });
  prisma = require('../src/config/database');
  riskService = require('../src/services/riskService');
});

test.after(async () => {
  await prisma?.$disconnect();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const assessByEmail = async (email) => {
  const user = await prisma.user.findUnique({ where: { email }, include: { patient: true } });
  assert.ok(user?.patient, `${email} não foi criado pelo seed`);
  const risk = await riskService.assessPatient(user.patient.id);
  return {
    patientId: user.patient.id,
    risk,
    level: Object.fromEntries(risk.oncology.conditions.map(c => [c.code, c.level])),
    byCode: Object.fromEntries(risk.oncology.conditions.map(c => [c.code, c])),
    screening: Object.fromEntries(risk.screening.map(s => [s.conditionCode, s])),
  };
};

test('Roberto: colorretal INVESTIGAR com exames, balança e triagem; TC de pulmão indicada', async () => {
  const { patientId, risk, level, byCode, screening } = await assessByEmail('roberto@healthinpulse.dev');
  assert.equal(level.CA_COLORRETAL, 'INVESTIGAR');
  assert.equal(risk.oncology.riskLevel, 'HIGH');
  assert.equal(screening.CA_PULMAO?.status, 'INDICADO_AGORA');
  assert.match(screening.CA_PULMAO.exam, /Tomografia/);

  // As três fontes de evidência chegaram ao motor
  assert.equal(risk.basedOn.profileFrom, 'TRIAGEM');
  assert.deepEqual(risk.basedOn.labs.map(l => l.ruleCode).sort(), ['FIT_POSITIVO', 'HB_BAIXA_HOMEM']);
  assert.equal(risk.basedOn.weightTrend?.lost, true);
  const why = byCode.CA_COLORRETAL.contributions.filter(c => c.delta > 0).map(c => c.code).sort();
  assert.deepEqual(why, ['anemia_hb_baixa', 'fit_positivo', 'mudanca_habito_intestinal', 'perda_peso_objetiva']);

  // Triagem concluída pelo motor, AiReport HIGH e a médica avisada
  const triage = await prisma.triageAnswer.findFirst({ where: { patientId, status: 'COMPLETED' }, include: { aiReport: true } });
  assert.equal(triage.riskLevel, 'HIGH');
  assert.equal(triage.aiReport?.riskLevel, 'HIGH');
  const state = JSON.parse(triage.answers);
  assert.equal(state.answers.mudanca_habito_intestinal, 1);
  assert.equal(state.answers.fadiga_diurna, 1);
  assert.equal(state.result.oncology.conditions.find(c => c.code === 'CA_COLORRETAL').level, 'INVESTIGAR');

  const doctor = await prisma.doctor.findFirst({ where: { patients: { some: { patientId } } }, include: { user: true } });
  assert.equal(doctor?.user.email, 'doctor@healthinpulse.dev');
  const alert = await prisma.notification.findFirst({ where: { userId: doctor.userId, type: 'ALERT' } });
  assert.match(alert?.message ?? '', /Roberto/);
});

test('Marina: mama ATENÇÃO pelo perfil (perguntas de mama sem resposta), HPV e rastreio de alto risco', async () => {
  const { patientId, risk, level, byCode, screening } = await assessByEmail('marina@healthinpulse.dev');
  assert.equal(level.CA_MAMA, 'ATENÇÃO');
  assert.ok(byCode.CA_MAMA.relativeRisk >= 2, `RR ${byCode.CA_MAMA.relativeRisk}`);
  assert.deepEqual(risk.profile.familyHistoryCancer, ['mama']);
  assert.equal(risk.profile.papEmDia, false);
  assert.equal(screening.CA_MAMA?.kind, 'ALTO_RISCO');
  assert.equal(screening.CA_COLO_UTERO?.status, 'INDICADO_AGORA');
  assert.match(screening.CA_COLO_UTERO.exam, /HPV/);
  assert.ok(!level.CA_PROSTATA, 'próstata para mulher');

  // Nenhum "não" nas perguntas de mama (derrubaria o RR para ~1,2)
  const triage = await prisma.triageAnswer.findFirst({ where: { patientId, status: 'COMPLETED' } });
  const { answers } = JSON.parse(triage.answers);
  for (const code of ['nodulo_mama', 'alteracao_mamilo', 'alteracao_pele_mama']) {
    assert.ok(answers[code] == null, `${code} = ${answers[code]}`);
  }
});

test('João: câncer em ROTINA; FIT indicado e PSA em decisão compartilhada', async () => {
  const { risk, screening } = await assessByEmail('joao@healthinpulse.dev');
  assert.equal(risk.oncology.level, 'ROTINA');
  assert.equal(screening.CA_COLORRETAL?.status, 'INDICADO_AGORA');
  assert.equal(screening.CA_PROSTATA?.status, 'DECISAO_COMPARTILHADA');
  assert.ok(!screening.CA_PULMAO, 'TC de pulmão para quem nunca fumou');
});

test('seed: metas e saldo curados de João e Marina não ganham duplicatas da triagem', async () => {
  for (const [email, coins] of [['joao@healthinpulse.dev', 220], ['marina@healthinpulse.dev', 360]]) {
    const user = await prisma.user.findUnique({ where: { email }, include: { patient: true } });
    assert.equal(user.patient.healthCoins, coins, email);
    const titles = (await prisma.healthGoal.findMany({ where: { patientId: user.patient.id } })).map(g => g.title);
    assert.equal(new Set(titles).size, titles.length, `${email}: metas repetidas ${titles}`);
  }
});
