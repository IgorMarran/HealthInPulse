#!/usr/bin/env node
// Teste de fumaça: sobe o backend de verdade e confere o caminho feliz.
// Roda no CI (Windows, macOS, Linux) e serve para conferir uma máquina nova.
//
//   npm run smoke                 sobe o backend local (precisa do `npm run setup` antes)
//   npm run smoke -- --url=URL    só testa um servidor já rodando (ex.: o deploy)
//   --demo-password=SENHA         testa também o portão da demo (DEMO_PASSWORD)

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'backend');
const PORT    = process.env.SMOKE_PORT || '3999';

const urlArg  = process.argv.find((a) => a.startsWith('--url='));
const BASE    = urlArg ? urlArg.slice('--url='.length).replace(/\/$/, '') : `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = urlArg ? 120_000 : 30_000; // deploy grátis pode estar "dormindo"
const DEMO_PASSWORD = process.argv.find((a) => a.startsWith('--demo-password='))
  ?.slice('--demo-password='.length);

const DEMO_USERS = [
  { email: 'joao@healthinpulse.dev',   password: 'Joao@123',   dashboard: '/api/patient/dashboard' },
  { email: 'marina@healthinpulse.dev', password: 'Marina@123', dashboard: '/api/patient/dashboard' },
  { email: 'doctor@healthinpulse.dev', password: 'Doctor@123', dashboard: '/api/doctor/dashboard' },
];

let failures = 0;
let finished = false;
let gateCookie = null; // cookie do portão da demo, depois da senha certa

// Sem isto, uma falha silenciosa vira CI verde: o fetch do Node 20 pode
// ficar pendurado sem segurar o processo (ex.: porta do Docker aceitando
// conexão antes do app subir) e o Node sai com código 0 no meio do teste.
process.on('beforeExit', () => {
  if (!finished) {
    console.error('\nSmoke terminou sem concluir as verificações.');
    process.exitCode = 1;
  }
});

// Timer próprio (ref'd) mantém o processo vivo e aborta requisição travada.
async function http(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`sem resposta em 10s: ${url}`)), 10_000);
  try {
    const headers = { ...(gateCookie && { cookie: gateCookie }), ...opts.headers };
    return await fetch(url, { ...opts, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✖\x1b[0m ${name}\n      ${err.message}`);
  }
};

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function waitForHealth() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await http(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${BASE}/health não respondeu em ${TIMEOUT_MS / 1000}s`);
}

function startBackend() {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: BACKEND,
    env: {
      ...process.env, PORT, NODE_ENV: 'test', LOG_LEVEL: 'warn',
      ...(DEMO_PASSWORD && { DEMO_PASSWORD }),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(`backend saiu com código ${code}`);
  });
  return child;
}

async function checkDemoGate() {
  const form = (password) => ({
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password, next: '/doctor/dashboard' }),
  });

  await check('portão: sem senha, navegador vai para /demo-access e API dá 401', async () => {
    const page = await http(`${BASE}/doctor/dashboard`, { redirect: 'manual', headers: { accept: 'text/html' } });
    assert(page.status === 302, `página respondeu ${page.status}`);
    assert(page.headers.get('location')?.startsWith('/demo-access'), `redirect para ${page.headers.get('location')}`);

    const api = await http(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: DEMO_USERS[0].email, password: DEMO_USERS[0].password }),
    });
    assert(api.status === 401, `login sem passar pelo portão respondeu ${api.status}`);
  });

  await check('portão: senha errada é recusada', async () => {
    const res = await http(`${BASE}/demo-access`, form('senha-errada'));
    assert(res.status === 401, `respondeu ${res.status}`);
    assert(!res.headers.get('set-cookie'), 'emitiu cookie com senha errada');
  });

  await check('portão: senha certa libera e volta para a página pedida', async () => {
    const res = await http(`${BASE}/demo-access`, form(DEMO_PASSWORD));
    assert(res.status === 303, `respondeu ${res.status}`);
    assert(res.headers.get('location') === '/doctor/dashboard', `redirect para ${res.headers.get('location')}`);
    const cookie = res.headers.get('set-cookie');
    assert(cookie?.includes('HttpOnly'), 'cookie sem HttpOnly');
    gateCookie = cookie.split(';')[0];
  });
}

async function main() {
  let backend;
  if (!urlArg) {
    if (!existsSync(join(BACKEND, '.env'))) {
      console.error('backend/.env não existe: rode `npm run setup` antes.');
      process.exit(1);
    }
    backend = startBackend();
  }

  console.log(`Smoke test em ${BASE}`);
  try {
    await check('GET /health responde', waitForHealth);

    if (DEMO_PASSWORD) await checkDemoGate();

    for (const user of DEMO_USERS) {
      await check(`login + dashboard (${user.email})`, async () => {
        const login = await http(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: user.email, password: user.password }),
        });
        const body = await login.text();
        assert(login.ok, `login respondeu ${login.status}: ${body}`);
        const { accessToken } = JSON.parse(body);
        assert(accessToken, 'login não devolveu accessToken');

        const dash = await http(`${BASE}${user.dashboard}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        assert(dash.ok, `${user.dashboard} respondeu ${dash.status}`);
      });
    }

    await check('rota protegida recusa sem token', async () => {
      const res = await http(`${BASE}/api/patient/dashboard`);
      assert(res.status === 401, `esperava 401, veio ${res.status}`);
    });

    await check('socket.io aceita handshake', async () => {
      const res  = await http(`${BASE}/socket.io/?EIO=4&transport=polling`);
      const body = await res.text();
      assert(res.ok && body.startsWith('0{'), `resposta inesperada: ${res.status} ${body.slice(0, 60)}`);
    });

    const servesFrontend = urlArg || existsSync(join(ROOT, 'frontend', 'dist', 'index.html'));
    if (servesFrontend) {
      await check('frontend servido (/ e rota do React Router)', async () => {
        for (const path of ['/', '/doctor/dashboard']) {
          const res = await http(`${BASE}${path}`);
          const html = await res.text();
          assert(res.ok && html.includes('id="root"'), `${path} não devolveu o index.html (${res.status})`);
        }
      });

      await check('rota de API inexistente dá 404 JSON, não o index.html', async () => {
        for (const path of ['/api', '/api/nao-existe']) {
          const res = await http(`${BASE}${path}`);
          assert(res.status === 404, `${path} respondeu ${res.status}`);
          assert(res.headers.get('content-type')?.includes('json'), `${path} não devolveu JSON`);
        }
      });
    }
  } finally {
    backend?.kill();
  }

  if (failures) {
    console.error(`\n${failures} verificação(ões) falharam.`);
    process.exit(1);
  }
  finished = true;
  console.log('\nTudo certo.');
}

main();
