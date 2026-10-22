// ─── O que o paciente vê (regra R2) ────────────────────────────────
// O paciente e o visitante do /teste nunca ouvem doença: nada de nome de
// condição, órgão, "risco de X", selo INVESTIGAR nem probabilidade. Quem
// vê o risco por doença é a médica (rotas e eventos dela não passam
// por aqui).
//
// O filtro é no backend: as rotas e os eventos do paciente mandam só o
// que sai deste arquivo. Esconder na tela não bastaria (o DevTools mostra
// a resposta inteira).
//
// O paciente vê:
//   1. próximo passo: ROTINA, CONSULTA ou AGORA;
//   2. sinais da pulseira comparados com a faixa normal (com fonte);
//   3. exames preventivos da idade e do sexo (só as regras POPULACIONAL
//      e as de decisão compartilhada, sem dizer o que previnem);
//   4. metas (goalService).

const { normalRanges, goalTemplates, sourceShort } = require('./clinical/data/prevention');
const { normalizeProfile } = require('./clinical/profile');

const STEP = { ROTINA: 'ROTINA', CONSULTA: 'CONSULTA', AGORA: 'AGORA' };

const STEP_TEXT = {
  ROTINA: {
    title: 'Manter a rotina',
    text:  'Seus dados estão dentro do esperado. Continue com seus hábitos e com as metas.',
  },
  CONSULTA: {
    title: 'Agendar consulta',
    text:  'Vale conversar com seu médico. Leve este resultado: ele vai avaliar com você e pedir o que for preciso.',
  },
};

// Sinal de alarme: o rótulo do redFlags.js cita doença ("Suspeita de
// AVC"); para o paciente vai só a ação, com o telefone quando couber.
const urgentStep = (redFlag) => {
  const action = String(redFlag?.action ?? '');
  if (/CVV/i.test(action)) {
    return { code: STEP.AGORA, title: 'Procure apoio agora',
      text: 'Ligue 188 (CVV): atendimento gratuito, 24 horas, por telefone ou chat em cvv.org.br. Se estiver em perigo, ligue 192.',
      phone: '188' };
  }
  if (redFlag?.urgency === 'EMERGENCY' || /SAMU/i.test(action)) {
    return { code: STEP.AGORA, title: 'Procure atendimento agora',
      text: 'Ligue 192 (SAMU) ou vá ao pronto-socorro mais próximo agora.', phone: '192' };
  }
  return { code: STEP.AGORA, title: 'Procure atendimento agora',
    text: 'Vá a um pronto-socorro ou UPA o quanto antes. Leve este resultado.' };
};

const ONCO_CONSULT_LEVELS = ['ATENÇÃO', 'INVESTIGAR'];

// Próximo passo a partir do resultado da triagem (state.result)
const nextStepFor = (result) => {
  if (!result) return null;
  if (result.redFlag) return urgentStep(result.redFlag);
  const onco = result.oncology;
  const oncoConsult = (onco?.conditions ?? []).some(c => ONCO_CONSULT_LEVELS.includes(c.level))
    || (onco?.screening ?? []).some(s => s.kind === 'ALTO_RISCO' && s.status !== 'FUTURO');
  const code = result.riskLevel === 'LOW' && !oncoConsult ? STEP.ROTINA : STEP.CONSULTA;
  return { code, ...STEP_TEXT[code] };
};

// Sinais da pulseira x faixa normal. Só entra o que tem número.
const vitalsVsNormal = (wearable = {}) => {
  if (!wearable?.hasData) return [];
  const out = [];
  for (const r of normalRanges) {
    const raw = wearable[r.field] ?? (r.fallbackField ? wearable[r.fallbackField] : null);
    if (raw == null) continue;
    const value = Math.round(raw);
    const status = r.min != null && value < r.min ? 'ABAIXO'
      : r.max != null && value > r.max ? 'ACIMA' : 'NORMAL';
    const range = r.min != null && r.max != null ? `${r.min} a ${r.max} ${r.unit}`
      : r.max != null ? `até ${r.max} ${r.unit}` : `a partir de ${r.min} ${r.unit}`;
    out.push({ code: r.code, label: r.label, value, unit: r.unit, status, normalRange: range,
      source: sourceShort[r.sourceCode] ?? null });
  }
  return out;
};

// Exames preventivos sem nome de doença. ALTO_RISCO fica só com a médica
// (mostrar já sinaliza risco); o paciente vê o que vale para todo mundo
// da idade e do sexo dele.
const screeningForPatient = (screening = []) => screening
  .filter(s => s.kind === 'POPULACIONAL' || s.kind === 'DECISAO_COMPARTILHADA')
  .map(s => {
    const years = s.intervalMonths ? s.intervalMonths / 12 : null;
    const every = years == null ? null : years === 1 ? 'todo ano' : `a cada ${years} anos`;
    const ages = s.minAge != null && s.maxAge != null ? `dos ${s.minAge} aos ${s.maxAge} anos`
      : s.minAge != null ? `a partir dos ${s.minAge} anos` : null;
    return {
      exam:   s.exam,
      status: s.status === 'FUTURO' ? 'FUTURO' : s.kind === 'DECISAO_COMPARTILHADA' ? 'CONVERSAR' : 'RECOMENDADO',
      text:   s.status === 'FUTURO'
        ? (s.kind === 'DECISAO_COMPARTILHADA'
          ? `${s.minAge != null ? `A partir dos ${s.minAge} anos, c` : 'C'}onverse com seu médico se vale a pena fazer.`
          : `Recomendado ${ages ?? 'mais adiante'}.`)
        : s.kind === 'DECISAO_COMPARTILHADA' ? `Converse com seu médico se vale a pena fazer${ages ? ` (${ages})` : ''}.`
        : `Recomendado para a sua idade${every ? `, ${every}` : ''}.`,
      startAge: s.startAge ?? null,
    };
  });

// Triagem concluída → visão do paciente
const triageResultView = (state = {}) => {
  const result = state.result ?? null;
  return {
    nextStep:  nextStepFor(result),
    vitals:    vitalsVsNormal(state.wearable),
    screening: screeningForPatient(result?.oncology?.screening),
  };
};

// Linhas da pulseira para a tela da triagem (sem doença)
const wearableLines = (wearable) => vitalsVsNormal(wearable)
  .filter(v => v.status !== 'NORMAL')
  .map(v => `${v.label}: ${v.value} ${v.unit}, ${v.status === 'ACIMA' ? 'acima' : 'abaixo'} da faixa normal (${v.normalRange})`);

// Resposta da triagem (buildResponse do triageService) → paciente
const triageResponse = (resp) => {
  if (!resp) return resp;
  const base = {
    triageId: resp.triageId, stage: resp.stage, status: resp.status,
    progress: resp.progress, wearableSummary: resp.wearableSummary ?? [],
    hasWearable: resp.hasWearable,
  };
  if (resp.stage === 'PROFILE') return { ...base, profile: resp.profile, schema: resp.schema };
  if (resp.stage === 'QUESTION') {
    // Sem leaderboard, sem hipótese-alvo e sem o "porquê" (citam doença)
    return { ...base, phase: resp.phase, question: resp.question };
  }
  return { ...base, profile: resp.profile, view: resp.view ?? null };
};

// Item do histórico de triagens
const triageHistoryItem = (t) => ({
  id: t.id, startedAt: t.startedAt, finishedAt: t.finishedAt, status: t.status,
  nextStep: t.status === 'COMPLETED' ? nextStepFor(t.answers?.result)?.code ?? null : null,
});

// Relatório (AiReport) → paciente. O da triagem vira a visão da triagem;
// os outros (exame, relatório completo da médica) ficam com a médica.
const reportForPatient = (report, triageState = null) => {
  const base = { id: report.id, type: report.type, generatedAt: report.generatedAt,
    doctor: report.doctor ?? null };
  if (report.type === 'triage' && triageState) {
    return { ...base, title: 'Resultado da triagem', ...triageResultView(triageState) };
  }
  return { ...base, title: report.type === 'exam' ? 'Análise de exame' : 'Relatório para a sua médica',
    nextStep: null, vitals: [], screening: [],
    text: 'Este relatório foi feito para a sua médica. Converse com ela sobre o conteúdo na consulta.' };
};

// Exame → paciente: só os achados com valor e a comparação com a faixa
// de referência do laboratório. Sem resumo (texto livre da IA pode citar
// doença) e sem nível de risco.
const FINDING_STATUS = { normal: 'NORMAL', alto: 'ACIMA', baixo: 'ABAIXO', critico: 'FORA' };
const examForPatient = (exam) => {
  if (!exam) return exam;
  const { examResult, ...rest } = exam;
  if (!examResult) return { ...rest, examResult: null };
  const findings = (Array.isArray(examResult.findings) ? examResult.findings : []).map(f => ({
    name: f.name, value: f.value, unit: f.unit ?? null,
    status: FINDING_STATUS[String(f.status ?? '').toLowerCase()] ?? null,
  }));
  return {
    ...rest,
    examResult: {
      id: examResult.id, processedAt: examResult.processedAt ?? null, findings,
      outOfRange: findings.filter(f => f.status && f.status !== 'NORMAL').length,
    },
  };
};

// Hábitos com fonte que valem para o perfil (os mesmos modelos das metas,
// sem a de consulta e sem as que dependem da pulseira)
const HABIT_CODES = ['PARAR_DE_FUMAR', 'ATIVIDADE_150', 'REDUZIR_ALCOOL', 'IMC_NORMAL'];
const habitsFor = (profile) => goalTemplates
  .filter(t => HABIT_CODES.includes(t.code) && t.when({ profile, wearable: {}, nextStep: null }))
  .map(t => {
    const g = t.build({ profile, wearable: {} });
    return { code: t.code, title: g.title, text: g.description, source: sourceShort[t.sourceCode] ?? null };
  });

const VISITOR_DISCLAIMER = 'Teste educativo de prevenção, feito para a feira. Não é diagnóstico e não '
  + 'substitui uma consulta. Nada do que você respondeu foi gravado.';

// Teste público (/teste): saída do quickTestService.run → visitante
const quickTestForVisitor = (r, rawProfile = {}) => {
  if (!r) return r;
  if (r.stage === 'QUESTION') return { stage: r.stage, question: r.question, progress: r.progress };
  if (r.stage !== 'RESULT') return { ...r, disclaimer: VISITOR_DISCLAIMER };
  const result = {
    riskLevel: 'LOW',
    redFlag:   r.redFlag ?? null,
    oncology:  { conditions: r.oncology?.conditions ?? [], screening: r.screening ?? [] },
  };
  return {
    stage:      'RESULT',
    disclaimer: VISITOR_DISCLAIMER,
    nextStep:   nextStepFor(result),
    screening:  screeningForPatient([...(r.screening ?? []), ...(r.futureScreening ?? [])]),
    habits:     habitsFor(normalizeProfile(rawProfile)),
  };
};

module.exports = {
  quickTestForVisitor, habitsFor,
  examForPatient,
  STEP, nextStepFor, vitalsVsNormal, screeningForPatient, triageResultView,
  wearableLines, triageResponse, triageHistoryItem, reportForPatient,
};
