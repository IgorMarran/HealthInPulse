// ─── Teste rápido público (/teste) ──────────────────────────
// O visitante do stand responde em 2–3 minutos, no notebook ou no
// celular (QR). Fluxo: capa → perfil → uma pergunta por tela → resultado.
// A API é SEM ESTADO (POST /api/public/quick-test): a cada passo mandamos
// o perfil e todas as respostas acumuladas; nada é gravado.
//
// Fica FORA do PublicRoute (quem está logado também abre) e usa o
// publicApi (fetch puro: um 401 aqui não derruba a sessão nem manda
// para /login).
//
// ?kiosk=1 → volta sozinho à capa depois de 120 s sem toque.
// Personas (personas.js) preenchem tudo para a equipe demonstrar rápido.
//
// O visitante vê categoria, risco relativo e frequência natural; nunca o
// % (isso é da tela da médica).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, Info, Smartphone, RotateCcw, ChevronRight, Users, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { publicApi } from '@/services/publicApi';
import { PUBLIC_TEST_URL, KIOSK_IDLE_MS } from '@/config';
import { isFieldVisible, visibleProfile } from '@/lib/conditions';
import { oncoLevel, formatFactor, visitorSummary } from '@/lib/risk';
import ProfileField from '@/components/triage/ProfileField';
import QuestionCard from '@/components/triage/QuestionCard';
import ConditionRiskCard from '@/components/risk/ConditionRiskCard';
import ScreeningList from '@/components/risk/ScreeningList';
import FrequencyDots from '@/components/risk/FrequencyDots';
import Disclaimer from '@/components/common/Disclaimer';
import QrCode from '@/components/common/QrCode';
import { PERSONAS } from './personas';

// Campos numéricos curtos dividem a linha; os de rótulo longo ocupam tudo
const HALF_WIDTH = ['age', 'height', 'weight', 'packYears'];

const CALL_TIMEOUT_MS = 20 * 1000;

// Aviso do visitante (o da API fala de "porcentagens", que ele não vê)
const QUICKTEST_DISCLAIMER = 'Teste educativo feito para a feira. Não é diagnóstico e não substitui '
  + 'uma consulta: os números são estimativas a partir de estudos publicados. Nada do que você respondeu foi gravado.';

export default function QuickTest() {
  const [params] = useSearchParams();
  const kiosk = params.get('kiosk') === '1';

  const [step, setStep]       = useState('COVER'); // COVER | PROFILE | QUESTION | BLOCKED | RESULT
  const [schema, setSchema]   = useState(null);
  const [profile, setProfile] = useState({});
  const [answers, setAnswers] = useState({});
  const [order, setOrder]     = useState([]);      // [[códigos de uma tela], ...] para o "Voltar"
  const [res, setRes]         = useState(null);    // última resposta da API
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);    // { message, fields }
  const [persona, setPersona] = useState(null);

  // Geração: cada reset invalida as respostas da API ainda a caminho
  // (ex.: o quiosque volta à capa enquanto uma chamada lenta termina).
  const genRef   = useRef(0);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    genRef.current += 1;
    abortRef.current?.abort();
    setStep('COVER'); setProfile({}); setAnswers({}); setOrder([]);
    setRes(null); setError(null); setPersona(null); setBusy(false);
  }, []);

  // Uma chamada à API. Devolve a resposta ou null (erro já mostrado).
  // Tempo máximo de 20 s (o Render acorda devagar depois de parado);
  // resposta de uma geração antiga é descartada.
  const call = async (body) => {
    const gen = genRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort('timeout'), CALL_TIMEOUT_MS);
    setBusy(true); setError(null);
    try {
      const data = await publicApi.quickTest(body, { signal: ctrl.signal });
      if (gen !== genRef.current) return null;
      setRes(data);
      if (data.stage === 'PROFILE') setSchema(data.schema);
      setStep(data.stage);
      return data;
    } catch (e) {
      // Reset ou chamada mais nova cancelou esta: descarta em silêncio
      if (gen !== genRef.current) return null;
      if (ctrl.signal.aborted && ctrl.signal.reason !== 'timeout') return null;
      const timedOut = ctrl.signal.aborted;
      setError(timedOut
        ? { message: 'O servidor demorou para responder (ele pode estar acordando). Toque de novo em alguns segundos.', fields: [] }
        : { message: e.message, fields: e.fields ?? [] });
      return null;
    } finally {
      clearTimeout(timer);
      // Só a chamada vigente desliga o "ocupado"
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        if (gen === genRef.current) setBusy(false);
      }
    }
  };

  // ─── Ações ─────────────────────────────────────────────────
  const start = async (p = null) => {
    setPersona(p);
    setProfile(p ? { ...p.profile } : {});
    setAnswers({}); setOrder([]);
    if (schema) { setError(null); setStep('PROFILE'); return; }
    await call({});
  };

  const sendProfile = () => {
    const prof = visibleProfile(schema, profile);
    const ans = persona ? { ...persona.answers } : {};
    setAnswers(ans);
    setOrder([]);
    call({ profile: prof, answers: ans });
  };

  const answer = async (value, followUps) => {
    const q = res?.question;
    if (!q) return;
    const next = { ...answers, [q.id]: value };
    const keys = [q.id];
    for (const fu of followUps ?? []) { next[fu.id] = fu.value; keys.push(fu.id); }
    // Só guarda a resposta se a API aceitou (erro de rede: tenta de novo)
    if (await call({ profile: visibleProfile(schema, profile), answers: next })) {
      setAnswers(next);
      setOrder((o) => [...o, keys]);
    }
  };

  const back = async () => {
    if (order.length === 0) { setError(null); setStep('PROFILE'); return; }
    const last = order[order.length - 1];
    const next = { ...answers };
    for (const k of last) delete next[k];
    if (await call({ profile: visibleProfile(schema, profile), answers: next })) {
      setAnswers(next);
      setOrder((o) => o.slice(0, -1));
    }
  };

  // ─── Topo da página a cada tela nova ───────────────────────
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step, res]);

  // ─── Modo quiosque: 120 s parado → capa ────────────────────
  useEffect(() => {
    if (!kiosk || step === 'COVER') return undefined;
    let t = setTimeout(reset, KIOSK_IDLE_MS);
    const poke = () => { clearTimeout(t); t = setTimeout(reset, KIOSK_IDLE_MS); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((ev) => window.addEventListener(ev, poke, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((ev) => window.removeEventListener(ev, poke));
    };
  }, [kiosk, step, reset]);

  return (
    <div className="min-h-dvh flex flex-col bg-surface-50">
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button type="button" onClick={reset} className="text-left" aria-label="Voltar à capa">
            <span className="font-display text-base font-bold tracking-tight">
              Health<span className="text-brand-600">InPulse</span>
            </span>
            <span className="hidden sm:inline text-sm text-surface-500 ml-2">Teste rápido de risco de câncer</span>
          </button>
          {step !== 'COVER' && (
            <button type="button" onClick={reset} className="btn-ghost text-xs px-3">
              <RotateCcw size={14} /> Recomeçar
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {step === 'COVER' && (
          <Cover onStart={() => start()} onPersona={start} busy={busy} error={error} kiosk={kiosk} />
        )}

        {step === 'PROFILE' && schema && (
          <ProfileStep
            schema={schema} profile={profile} setProfile={setProfile}
            persona={persona} busy={busy} error={error}
            onSubmit={sendProfile} onBack={reset}
          />
        )}

        {step === 'QUESTION' && res?.question && (
          <div className="max-w-xl mx-auto space-y-4 animate-fade-in">
            {persona && <PersonaNote persona={persona} />}
            <QuestionCard
              question={res.question}
              progress={res.progress}
              reason={res.reason}
              busy={busy}
              onAnswer={answer}
              onBack={back}
              size="lg"
              allowUnknown
              followUpMode="afterYes"
            />
            {error && <ErrorBox error={error} />}
            <p className="text-xs text-surface-400 text-center">Nada do que você responde é gravado.</p>
          </div>
        )}

        {step === 'BLOCKED' && (
          <div className="max-w-xl mx-auto glass p-6 sm:p-8 space-y-4 text-center animate-fade-in">
            <Info size={32} className="mx-auto text-brand-600" aria-hidden />
            <p className="text-surface-700">{res?.reason}</p>
            <button type="button" onClick={reset} className="btn-primary mx-auto">Voltar ao início</button>
          </div>
        )}

        {step === 'RESULT' && res && (
          <Result res={res} persona={persona} onRestart={reset} />
        )}
      </main>

      <footer className="border-t border-surface-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Disclaimer variant="inline" audience="visitor" text="Teste educativo feito para a feira. Não é diagnóstico e não substitui uma consulta. Nada do que você responde é gravado." />
        </div>
      </footer>
    </div>
  );
}

// ─── Capa ────────────────────────────────────────────────────
function Cover({ onStart, onPersona, busy, error, kiosk }) {
  return (
    <div className="animate-fade-in">
      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-6">
          <h1 className="font-display text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-brand-900">
            Seu risco de câncer, explicado em 2 minutos.
          </h1>
          <p className="text-surface-600 text-base sm:text-lg leading-relaxed max-w-prose">
            Responda até 8 perguntas. Para cada tipo de câncer, você vê como se compara com pessoas da sua idade
            e sexo, o porquê de cada resultado e quais exames de rastreamento valem para você.
          </p>
          <ul className="grid gap-2 text-sm text-surface-700 sm:grid-cols-2">
            <li className="flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" aria-hidden /> Nada é gravado, sem login</li>
            <li className="flex items-center gap-2"><Info size={16} className="text-brand-600" aria-hidden /> Não é diagnóstico</li>
          </ul>
          <div className="space-y-3">
            <button type="button" onClick={onStart} disabled={busy}
              className="btn-primary text-base px-7 py-3.5 w-full sm:w-auto justify-center">
              {busy ? 'Abrindo…' : <>Começar o teste <ChevronRight size={18} /></>}
            </button>
            {error && <ErrorBox error={error} />}
          </div>
        </div>

        {/* A ideia do resultado: frequência natural em pontos */}
        <figure className="glass p-5 sm:p-6">
          <FrequencyDots frequency="~3 em 1.000" level="ATENÇÃO" className="w-full" />
          <figcaption className="text-sm text-surface-600 mt-4 leading-relaxed">
            <strong className="font-display text-lg text-surface-900 block">~3 em 1.000</strong>
            É assim que mostramos o risco: entre 1.000 pessoas com respostas como as suas, quantas
            recebem esse diagnóstico em 2 anos.
          </figcaption>
        </figure>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="hidden md:flex glass p-4 items-center gap-4 max-w-md">
          <QrCode value={PUBLIC_TEST_URL} size={kiosk ? 148 : 112} />
          <div>
            <p className="font-medium text-surface-800 flex items-center gap-1.5"><Smartphone size={16} aria-hidden /> Prefere responder no celular?</p>
            <p className="text-sm text-surface-500 mt-1">Algumas perguntas são íntimas. Aponte a câmera e faça com privacidade.</p>
          </div>
        </div>

        <div className="md:self-end md:justify-self-end">
          <p className="text-xs text-surface-400 mb-2 flex items-center gap-1.5"><Users size={13} aria-hidden /> Demonstração da equipe</p>
          <div className="flex flex-wrap gap-2">
            {PERSONAS.map((p) => (
              <button key={p.id} type="button" onClick={() => onPersona(p)} disabled={busy}
                title={p.summary}
                className="text-xs px-3 py-1.5 rounded-full border border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Perfil ──────────────────────────────────────────────────
function ProfileStep({ schema, profile, setProfile, persona, busy, error, onSubmit, onBack }) {
  const ready = profile.age != null && profile.age !== '' && profile.sex;
  return (
    <div className="max-w-xl mx-auto space-y-4 animate-fade-in">
      {persona && <PersonaNote persona={persona} />}
      <form className="glass p-5 sm:p-8 space-y-6"
        onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onSubmit(); }}>
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-surface-900">Sobre você</h2>
          <p className="text-sm text-surface-500 mt-1">
            Só idade e sexo são obrigatórios. O resto deixa a estimativa mais precisa.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {schema.map((field) => (
            <ProfileField
              key={field.id}
              field={field}
              value={profile[field.field]}
              onChange={(v) => setProfile((p) => ({ ...p, [field.field]: v }))}
              visible={isFieldVisible(field, profile)}
              size="lg"
              wide={!HALF_WIDTH.includes(field.id)}
            />
          ))}
        </div>
        {!ready && !error && (
          <p className="text-sm text-surface-500">Preencha idade e sexo para continuar.</p>
        )}
        {error && <ErrorBox error={error} />}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="btn-ghost"><ArrowLeft size={15} /> Voltar</button>
          <button type="submit" disabled={!ready || busy}
            className="btn-primary flex-1 justify-center py-3 text-base">
            {busy ? 'Enviando…' : <>{persona ? 'Ver o resultado' : 'Continuar'} <ChevronRight size={17} /></>}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Resultado ───────────────────────────────────────────────
function Result({ res, persona, onRestart }) {
  const onco = res.oncology ?? {};
  const lv = oncoLevel(onco.level);
  const summary = visitorSummary(onco.level, onco.conditions ?? []);
  const conditions = onco.conditions ?? [];
  const eligible = conditions.filter((c) => c.eligible);
  const ineligible = conditions.filter((c) => !c.eligible);
  const todo = buildTodo(res);

  return (
    <div className="space-y-6 animate-fade-in">
      {persona && <PersonaNote persona={persona} />}

      <section className={clsx('glass p-5 sm:p-7 border-l-4', {
        'border-l-green-500':  onco.level === 'ROTINA',
        'border-l-amber-500':  onco.level === 'ATENÇÃO',
        'border-l-orange-500': onco.level === 'INVESTIGAR',
      })}>
        <span className={lv.badge}>{lv.label}</span>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-surface-900 mt-3 leading-tight">{summary.headline}</h1>
        <p className="text-surface-600 mt-2 max-w-prose leading-relaxed">{summary.text}</p>
        {res.redFlag && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-orange-600 shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-orange-900">{res.redFlag.label}</p>
              <p className="text-orange-800 mt-0.5">{res.redFlag.action}</p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="qt-cancers">
        <h2 id="qt-cancers" className="font-display text-lg font-semibold text-surface-800 mb-3">Por tipo de câncer</h2>
        {eligible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            {eligible.map((c) => <ConditionRiskCard key={c.code} condition={c} audience="visitor" />)}
          </div>
        ) : (
          <p className="text-sm text-surface-500 glass p-4">
            Na sua idade, nenhum destes cânceres entra na triagem ainda. Veja abaixo quando começar os exames.
          </p>
        )}
        {ineligible.length > 0 && (
          <p className="text-xs text-surface-500 mt-3">
            {ineligible.map((c) => `${c.label}: ${(c.reason || '').toLowerCase()}`).join(' ')}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="glass p-5 sm:p-6" aria-labelledby="qt-screening">
          <h2 id="qt-screening" className="font-display text-lg font-semibold text-surface-800 mb-3">Exames de rastreamento para você</h2>
          <ScreeningList items={res.screening} future={res.futureScreening} audience="visitor" />
        </section>

        <section className="glass p-5 sm:p-6" aria-labelledby="qt-todo">
          <h2 id="qt-todo" className="font-display text-lg font-semibold text-surface-800 mb-3">O que você pode fazer</h2>
          <ul className="space-y-2.5">
            {todo.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700 leading-relaxed">
                <span className={clsx('w-1.5 h-1.5 rounded-full mt-2 shrink-0', t.tone)} aria-hidden />
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Disclaimer audience="visitor" text={QUICKTEST_DISCLAIMER} />

      <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
        <div className="hidden md:flex items-center gap-4">
          <QrCode value={PUBLIC_TEST_URL} size={104} />
          <div>
            <p className="font-medium text-surface-800 flex items-center gap-1.5"><Smartphone size={16} aria-hidden /> Faça no seu celular</p>
            <p className="text-sm text-surface-500 mt-1 max-w-xs">Leve o teste com você ou mostre para alguém da família.</p>
          </div>
        </div>
        <button type="button" onClick={onRestart} className="btn-primary text-base px-7 py-3.5 justify-center">
          <RotateCcw size={17} /> Novo teste
        </button>
      </div>
    </div>
  );
}

// "O que você pode fazer": ação pelo nível, rastreamento e fatores mudáveis
function buildTodo(res) {
  const out = [];
  const level = res.oncology?.level;
  if (level === 'INVESTIGAR' || res.redFlag) {
    out.push({ tone: 'bg-orange-500', text: 'Marque uma consulta (na UBS ou com o seu médico) e conte o que respondeu aqui. Na maioria das vezes a causa não é câncer, mas vale examinar.' });
  } else if (level === 'ATENÇÃO') {
    out.push({ tone: 'bg-amber-500', text: 'Na próxima consulta, converse com o médico sobre os itens em "Atenção" e sobre quando fazer os exames.' });
  }
  if (res.screening?.length) {
    out.push({ tone: 'bg-brand-500', text: 'Mantenha em dia os exames de rastreamento da lista: eles acham o câncer cedo, quando o tratamento funciona melhor.' });
  }
  for (const m of res.modifiable ?? []) {
    const cond = m.conditionLabel?.replace(/^Câncer/, 'câncer');
    out.push(m.factor > 1
      ? { tone: 'bg-amber-500', text: `${m.label}: deixa a chance de ${cond} ${formatFactor(m.factor)} maior. Esse fator dá para mudar.` }
      : { tone: 'bg-green-500', text: `${m.label}: já diminui a chance de ${cond} (${formatFactor(m.factor)}). Continue assim.` });
  }
  out.push({ tone: 'bg-green-500', text: 'Não fumar, beber pouco, manter o peso e se movimentar reduzem o risco de vários tipos de câncer.' });
  return out;
}

function PersonaNote({ persona }) {
  return (
    <p className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 flex items-center gap-2">
      <Users size={13} aria-hidden /> Demonstração: {persona.name} ({persona.summary.toLowerCase()})
    </p>
  );
}

function ErrorBox({ error }) {
  return (
    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>{error.message}</p>
      {error.fields?.length > 0 && (
        <ul className="list-disc list-inside text-xs mt-1">
          {error.fields.map((f, i) => <li key={i}>{f.message}</li>)}
        </ul>
      )}
    </div>
  );
}
