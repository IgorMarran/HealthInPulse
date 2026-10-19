// ─── Evidência objetiva da pulseira ─────────────────────────────────
// Lê os dados mais recentes do paciente (VitalSign + WearableData) e
// converte em evidência bayesiana com peso proporcional à especificidade
// clínica real (IAH e SpO₂ noturna sobrepõem sintomas subjetivos).
//
// Também derivam-se SINTOMAS booleanos para entrar no motor — assim a
// pulseira não só calcula score em paralelo: ela passa a ser uma das
// "respostas" mais discriminativas da matriz.
//
// Fonte: Documentação triagem HealthInPulse (Fase 4).

const prisma = require('../../config/database');
const { S }  = require('./matrix');

const NIGHTLY_WINDOW_DAYS = 30; // Janela para considerar dados "recentes"

// Lê VitalSign mais recente + N últimos payloads brutos de wearable.
// Devolve um objeto plano com métricas derivadas e estado da pulseira.
const collectFromDatabase = async (patientId) => {
  const since = new Date(Date.now() - NIGHTLY_WINDOW_DAYS * 24 * 3600 * 1000);

  const [latestVital, vitalsWindow, rawWearables, device] = await Promise.all([
    prisma.vitalSign.findFirst({
      where:   { patientId },
      orderBy: { recordedAt: 'desc' },
    }),
    prisma.vitalSign.findMany({
      where:   { patientId, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'desc' },
      take:    200,
    }),
    prisma.wearableData.findMany({
      where:   { patientId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take:    30,
    }),
    prisma.device.findFirst({
      where:   { patientId, status: { in: ['ACTIVE', 'INACTIVE'] } },
      orderBy: { lastSyncAt: 'desc' },
    }),
  ]);

  // Extrai métricas avançadas dos payloads brutos
  const parsed = rawWearables.map(w => {
    try { return JSON.parse(w.payload || '{}'); } catch { return {}; }
  });

  const ahi = pickMaxNumber(parsed, ['ahi', 'iah', 'apnea_hypopnea_index']);
  const nocturnalSpO2 = pickMinNumber(parsed, [
    'nocturnal_spo2', 'spo2_nocturnal', 'spo2_min_night',
  ]);
  const hrv = pickAvgNumber(parsed, ['hrv', 'rmssd', 'sdnn']);
  const fcIrregular = pickBool(parsed, [
    'fc_irregular', 'rhythm_irregular', 'afib_suspected', 'irregular_beats',
  ]);
  const paroxysmalTach = pickMaxNumber(parsed, [
    'paroxysmal_tach_events', 'tachy_events', 'episodes_above_150',
  ]);
  const sleepHours = pickAvgNumber(parsed, ['sleep_hours', 'sleep_duration']);

  // Médias dos vitais nos últimos 30 dias — mais estáveis que o último
  // ponto isolado.
  const restingHrAvg = average(vitalsWindow.map(v => v.heartRate).filter(Boolean));
  const systolicAvg  = average(vitalsWindow.map(v => v.systolic).filter(Boolean));
  const diastolicAvg = average(vitalsWindow.map(v => v.diastolic).filter(Boolean));

  return {
    device: device && {
      id:        device.id,
      name:      device.name,
      type:      device.type,
      status:    device.status,
      lastSync:  device.lastSyncAt,
    },
    // Métricas pontuais mais recentes
    restingHr:        latestVital?.heartRate ?? null,
    restingSpO2:      latestVital?.oxygenSat ?? null,
    systolic:         latestVital?.systolic ?? null,
    diastolic:        latestVital?.diastolic ?? null,
    glucose:          latestVital?.glucose ?? null,
    temperature:      latestVital?.temperature ?? null,
    // Janela 30d (médias)
    restingHrAvg,
    systolicAvg,
    diastolicAvg,
    // Métricas derivadas (do payload bruto)
    ahi,
    nocturnalSpO2,
    hrv,
    fcIrregular,
    paroxysmalTach,
    sleepHours,
    // Metadados
    hasData: !!latestVital || rawWearables.length > 0,
    sampleSize: rawWearables.length,
  };
};

// Converte os números acima em evidência bayesiana ponderada.
// O "weight" reflete o quanto a evidência objetiva domina o produto:
// um IAH ≥ 15 entra como se o paciente tivesse confirmado 3 sintomas
// pesados de AOS.
const toBayesianEvidence = (w = {}) => {
  const ev = {};
  if (!w || !w.hasData) return ev;

  // ─── AOS — IAH e SpO₂ noturna são quase patognomônicos
  if (w.ahi != null) {
    if (w.ahi >= 15)      ev[S.APNEIA_OBSERVADA] = { value: 1, weight: 3 };
    else if (w.ahi >= 5)  ev[S.APNEIA_OBSERVADA] = { value: 1, weight: 2 };
  }
  if (w.nocturnalSpO2 != null && w.nocturnalSpO2 < 90) {
    ev[S.APNEIA_OBSERVADA] = { value: 1, weight: 3 };
    ev[S.RONCO_ALTO]       = { value: 1, weight: 1 };
  }
  if (w.sleepHours != null && w.sleepHours < 5) {
    ev[S.FADIGA_DIURNA] = { value: 1, weight: 1 };
  }

  // ─── Cardiovascular — PA + FC repouso
  if (w.systolicAvg != null && w.systolicAvg >= 140) {
    ev[S.HAS_CONHECIDA] = { value: 1, weight: 2 };
  } else if (w.systolic != null && w.systolic >= 140) {
    ev[S.HAS_CONHECIDA] = { value: 1, weight: 1 };
  }
  if (w.restingHrAvg != null && w.restingHrAvg > 100) {
    ev[S.PALPITACOES] = { value: 1, weight: 1 };
  }

  // ─── Arritmia — irregularidade + paroxismos
  if (w.fcIrregular) {
    ev[S.PALP_PAROXISTICAS] = { value: 1, weight: 2 };
    ev[S.PALPITACOES]       = { value: 1, weight: 2 };
  }
  if (w.paroxysmalTach != null && w.paroxysmalTach > 0) {
    ev[S.PALP_PAROXISTICAS] = { value: 1, weight: 3 };
  }
  if (w.hrv != null && w.hrv < 20) {
    // HRV cronicamente baixa — disfunção autonômica
    ev[S.FADIGA_DIURNA] = { value: 1, weight: 1 };
  }

  // ─── DPOC — SpO₂ em repouso
  if (w.restingSpO2 != null && w.restingSpO2 < 95) {
    ev[S.DISPNEIA_ESFORCO] = { value: 1, weight: 1 };
  }
  if (w.restingSpO2 != null && w.restingSpO2 < 92) {
    ev[S.DISPNEIA_REPOUSO] = { value: 1, weight: 2 };
  }

  // ─── DM2 — Glicemia
  if (w.glucose != null && w.glucose >= 200) {
    ev[S.POLIURIA]   = { value: 1, weight: 2 };
    ev[S.POLIDIPSIA] = { value: 1, weight: 2 };
  }

  return ev;
};

// Texto humano para mostrar ao paciente: "sua pulseira detectou ..."
const summarizeForPatient = (w = {}) => {
  if (!w?.hasData) return [];
  const items = [];
  if (w.ahi != null) {
    if (w.ahi >= 15) items.push(`IAH de ${w.ahi.toFixed(1)} ev/h — apneia moderada-grave detectada`);
    else if (w.ahi >= 5) items.push(`IAH de ${w.ahi.toFixed(1)} ev/h — apneia leve detectada`);
  }
  if (w.nocturnalSpO2 != null && w.nocturnalSpO2 < 90) {
    items.push(`Dessaturação noturna (SpO₂ mínima ${w.nocturnalSpO2.toFixed(0)}%)`);
  }
  if (w.systolicAvg != null && w.systolicAvg >= 140) {
    items.push(`PA sistólica média ${Math.round(w.systolicAvg)} mmHg — acima do alvo`);
  }
  if (w.restingHrAvg != null && w.restingHrAvg > 100) {
    items.push(`Frequência cardíaca de repouso elevada (${Math.round(w.restingHrAvg)} bpm em média)`);
  }
  if (w.fcIrregular) items.push('Padrão de batimentos irregular — possível fibrilação atrial');
  if (w.paroxysmalTach > 0) items.push(`${w.paroxysmalTach} evento(s) de taquicardia paroxística`);
  if (w.hrv != null && w.hrv < 20) items.push('Variabilidade cardíaca (HRV) cronicamente baixa');
  if (w.restingSpO2 != null && w.restingSpO2 < 95) items.push(`SpO₂ em repouso ${w.restingSpO2}%`);
  if (w.glucose != null && w.glucose > 180) items.push(`Glicemia recente ${Math.round(w.glucose)} mg/dL`);
  return items;
};

// ─── Tendência de peso (balança conectada) ─────────────────────────
// Queda ≥ 5% do peso em até 180 dias vira o achado `perda_peso_objetiva`
// (likelihood só nos cânceres colorretal e de pulmão). É uma chave NOVA,
// diferente de perda_peso_inexplicada (a pergunta), de propósito: o red
// flag NEOPLASIA olha a resposta da pergunta, não a balança. Quando a
// balança MOSTRA a perda, ela substitui a resposta no motor oncológico
// (ver riskEngine.SUPERSEDES: "pesado na balança").
//
// Regra (pura, testável):
//   - leituras com peso nos últimos `windowDays` (padrão 180);
//   - pico = maior peso ANTES da última leitura; queda = (pico − último)/pico;
//   - queda ≥ `threshold` (5%) → { perda_peso_objetiva: { value: 1 } };
//   - qualquer outro caso → SEM evidência. A balança nunca diz "não
//     perdeu peso": série velha, curta ou comprada depois da perda não
//     pode anular um "sim" da pessoa (decisão do controlador, revisão T5).
const WEIGHT_KEY = 'perda_peso_objetiva';

const weightTrendFromReadings = (readings = [], {
  now = new Date(), windowDays = 180, threshold = 0.05,
} = {}) => {
  const since = now.getTime() - windowDays * 24 * 3600 * 1000;
  const pts = readings
    .map(r => ({ at: new Date(r.recordedAt ?? r.at ?? r.date), kg: Number(r.weight ?? r.kg) }))
    .filter(p => Number.isFinite(p.kg) && p.kg > 0 && !Number.isNaN(p.at.getTime()))
    .filter(p => p.at.getTime() >= since && p.at.getTime() <= now.getTime())
    .sort((a, b) => a.at - b.at);

  const empty = { hasData: false, points: pts.length, evidence: {}, summary: null };
  if (pts.length < 2) return empty;

  const last = pts[pts.length - 1];
  const before = pts.slice(0, -1);
  const peak = before.reduce((m, p) => (p.kg > m.kg ? p : m), before[0]);
  const drop = Math.max(0, (peak.kg - last.kg) / peak.kg);
  const days = Math.round((last.at - peak.at) / (24 * 3600 * 1000));
  const spanDays = Math.round((last.at - pts[0].at) / (24 * 3600 * 1000));

  const base = {
    hasData: true, points: pts.length, firstAt: pts[0].at.toISOString(), lastAt: last.at.toISOString(),
    peakKg: peak.kg, peakAt: peak.at.toISOString(), lastKg: last.kg,
    dropPct: Number((drop * 100).toFixed(1)), days, spanDays, threshold,
  };
  const fmt = (n) => String(Number(n.toFixed(1))).replace('.', ',');
  if (drop >= threshold) {
    return { ...base, lost: true, evidence: { [WEIGHT_KEY]: { value: 1, weight: 1 } },
      summary: `Balança: perda de ${fmt(drop * 100)}% do peso em ${days} dias (${fmt(peak.kg)} → ${fmt(last.kg)} kg)` };
  }
  return { ...base, lost: false, evidence: {}, summary: null };
};

// Lê os pesos do paciente (VitalSign.weight, qualquer fonte: balança
// Care Plus, digitação...) e aplica a regra acima.
const collectWeightTrend = async (patientId, opts = {}) => {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 180;
  const readings = await prisma.vitalSign.findMany({
    where:   { patientId, weight: { not: null }, recordedAt: { gte: new Date(now.getTime() - windowDays * 24 * 3600 * 1000) } },
    select:  { weight: true, recordedAt: true },
    orderBy: { recordedAt: 'asc' },
  });
  return weightTrendFromReadings(readings, { ...opts, now, windowDays });
};

// ─── Helpers internos ──────────────────────────────────────────────
const pickMaxNumber = (objs, keys) => {
  let best = null;
  for (const o of objs) for (const k of keys) {
    const v = Number(o?.[k]);
    if (Number.isFinite(v) && (best == null || v > best)) best = v;
  }
  return best;
};
const pickMinNumber = (objs, keys) => {
  let best = null;
  for (const o of objs) for (const k of keys) {
    const v = Number(o?.[k]);
    if (Number.isFinite(v) && (best == null || v < best)) best = v;
  }
  return best;
};
const pickAvgNumber = (objs, keys) => {
  const vals = [];
  for (const o of objs) for (const k of keys) {
    const v = Number(o?.[k]);
    if (Number.isFinite(v)) vals.push(v);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};
const pickBool = (objs, keys) => {
  for (const o of objs) for (const k of keys) {
    if (o?.[k] === true || o?.[k] === 1 || o?.[k] === 'true') return true;
  }
  return false;
};
const average = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

module.exports = {
  collectFromDatabase,
  toBayesianEvidence,
  summarizeForPatient,
  collectWeightTrend,
  weightTrendFromReadings,
  WEIGHT_KEY,
};
