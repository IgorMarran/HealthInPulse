// ─── Teste rápido público (/teste, POST /api/public/quick-test) ─────
// Sem login e SEM ESTADO: o visitante manda a cada chamada tudo o que já
// respondeu ({ profile, answers }) e recebe a próxima etapa. Nada é
// gravado no banco nem escrito no log; as respostas vêm só da requisição.
//
//   PROFILE   falta idade ou sexo: devolve o formulário do perfil
//   BLOCKED   menor de 18 anos (o teste é para adultos)
//   QUESTION  próxima pergunta do painel RAPIDO (questionRunner, até 8)
//   RESULT    risco dos cânceres (riskEngine.assess), rastreamento e o
//             que a pessoa pode mudar
//
// Puro: recebe o kb (do banco ou do buildFromSeed) e o corpo já validado
// no formato pela rota (publicRoutes). Aqui ficam as regras que dependem
// do kb: só códigos de pergunta do painel RAPIDO (e seus follow-ups).

const riskEngine     = require('./clinical/riskEngine');
const questionRunner = require('./clinical/questionRunner');
const redFlags       = require('./clinical/redFlags');
const { candidatesFor, demographicSchema } = require('./clinical/questions');
const { normalizeProfile } = require('./clinical/profile');

const PANEL         = 'RAPIDO';
const MAX_QUESTIONS = 8;
const MIN_AGE       = 18;
const MAX_ANSWERS   = 30; // 8 perguntas + follow-ups, com folga

// Campos do perfil que o teste usa (os que entram no prior dos cânceres)
const PROFILE_FIELDS = [
  'age', 'sex', 'height', 'weight', 'smoker', 'packYears', 'quitYears',
  'alcoholDosesWeek', 'familyHistoryCancer', 'papEmDia',
];
const REQUIRED = ['age', 'sex'];

const DISCLAIMER = 'Teste educativo de risco, feito para a feira. Não é diagnóstico e não substitui '
  + 'uma consulta. As porcentagens são estimativas didáticas. Nada do que você respondeu foi gravado.';
const BLOCKED_REASON = 'O teste rápido é para maiores de 18 anos. Converse com seus pais ou responsáveis '
  + 'e com um profissional de saúde se tiver dúvidas.';

// Formulário do perfil: os campos da triagem que importam para câncer.
// Só idade e sexo são obrigatórios (altura e peso melhoram o IMC).
const profileSchema = () => demographicSchema()
  .filter(q => PROFILE_FIELDS.includes(q.id))
  .map(q => ({ ...q, required: REQUIRED.includes(q.id) }));

// Perguntas do painel RAPIDO (ativas) e os follow-ups delas
const allowedCodes = (kb) => {
  const out = new Set();
  for (const s of kb.symptoms) {
    if (s.active === false || s.kind !== 'QUESTION' || !(s.panels ?? []).includes(PANEL)) continue;
    out.add(s.code);
    for (const fu of s.followUps ?? []) out.add(fu.id);
  }
  return out;
};

const invalid = (fields) => Object.assign(new Error('Dados inválidos'), { status: 422, fields });

const pick = (obj, keys) => Object.fromEntries(
  Object.entries(obj ?? {}).filter(([k]) => keys.includes(k)),
);

// run(kb, { profile, answers }) → { stage, ... }
const run = (kb, { profile: rawProfile = {}, answers: rawAnswers = {} } = {}) => {
  rawAnswers = rawAnswers ?? {};
  const codes = Object.keys(rawAnswers);
  if (codes.length > MAX_ANSWERS) {
    throw invalid([{ field: 'answers', message: `No máximo ${MAX_ANSWERS} respostas` }]);
  }
  const allowed = allowedCodes(kb);
  const unknown = codes.filter(c => !allowed.has(c));
  if (unknown.length) {
    throw invalid(unknown.map(c => ({ field: `answers.${c}`, message: 'Pergunta desconhecida' })));
  }

  // ─── 1. Perfil ────────────────────────────────────────────────
  const profile = normalizeProfile(pick(rawProfile, PROFILE_FIELDS));
  const missing = REQUIRED.filter(f => profile[f] == null);
  if (missing.length) {
    return { stage: 'PROFILE', schema: profileSchema(), missing, disclaimer: DISCLAIMER };
  }
  if (profile.age < MIN_AGE) {
    return { stage: 'BLOCKED', reason: BLOCKED_REASON, minAge: MIN_AGE, disclaimer: DISCLAIMER };
  }

  // ─── 2. Respostas: só as das perguntas que valem para este perfil ─
  // (ex.: homem que mandou "nódulo na mama" não conta)
  const visible = new Set();
  for (const c of candidatesFor(kb, profile, PANEL)) {
    visible.add(c.symptom);
    for (const fu of c.question.followUps ?? []) visible.add(fu.id);
  }
  const answers = pick(rawAnswers, [...visible]);

  // ─── 3. Próxima pergunta (red flag encerra na hora) ───────────
  const flagged = redFlags.detectRedFlag({ answers });
  if (!flagged) {
    const next = questionRunner.next(kb, { profile, answers, panel: PANEL, max: MAX_QUESTIONS });
    if (next) {
      return { stage: 'QUESTION', question: next.question, reason: next.reason, progress: next.progress };
    }
  }

  // ─── 4. Resultado ─────────────────────────────────────────────
  const a = riskEngine.assess(kb, { profile, answers });
  return {
    stage:      'RESULT',
    disclaimer: DISCLAIMER,
    redFlag:    a.redFlag,
    oncology: {
      kbVersion:  a.kbVersion,
      level:      a.oncologyLevel,     // ROTINA / ATENÇÃO / INVESTIGAR
      riskLevel:  a.oncologyRiskLevel, // LOW / MODERATE / HIGH
      conditions: a.oncology,
    },
    screening:       a.screening.filter(s => s.status !== 'FUTURO'),
    futureScreening: a.screening.filter(s => s.status === 'FUTURO'),
    modifiable:      a.modifiable,
  };
};

module.exports = {
  run,
  allowedCodes,
  profileSchema,
  PANEL,
  MAX_QUESTIONS,
  MAX_ANSWERS,
  MIN_AGE,
  PROFILE_FIELDS,
  DISCLAIMER,
};
