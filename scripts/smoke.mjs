#!/usr/bin/env node
// Teste de fumaça: sobe o backend de verdade e confere o caminho feliz.
// Roda no CI (Windows, macOS, Linux) e serve para conferir uma máquina nova.
//
//   npm run smoke                 sobe o backend local (precisa do `npm run setup` antes)
//   npm run smoke -- --url=URL    só testa um servidor já rodando (ex.: o deploy)

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

const DEMO_USERS = [
  { email: 'joao@healthinpulse.dev',   password: 'Joao@123',   dashboard: '/api/patient/dashboard' },
  { email: 'marina@healthinpulse.dev', password: 'Marina@123', dashboard: '/api/patient/dashboard' },
  { email: 'doctor@healthinpulse.dev', password: 'Doctor@123', dashboard: '/api/doctor/dashboard' },
];

let failures = 0;
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
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${BASE}/health não respondeu em ${TIMEOUT_MS / 1000}s`);
}

function startBackend() {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: BACKEND,
    env: { ...process.env, PORT, NODE_ENV: 'test', LOG_LEVEL: 'warn' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(`backend saiu com código ${code}`);
  });
  return child;
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

    for (const user of DEMO_USERS) {
      await check(`login + dashboard (${user.email})`, async () => {
        const login = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: user.email, password: user.password }),
        });
        const body = await login.text();
        assert(login.ok, `login respondeu ${login.status}: ${body}`);
        const { accessToken } = JSON.parse(body);
        assert(accessToken, 'login não devolveu accessToken');

        const dash = await fetch(`${BASE}${user.dashboard}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        assert(dash.ok, `${user.dashboard} respondeu ${dash.status}`);
      });
    }

    await check('rota protegida recusa sem token', async () => {
      const res = await fetch(`${BASE}/api/patient/dashboard`);
      assert(res.status === 401, `esperava 401, veio ${res.status}`);
    });

    await check('socket.io aceita handshake', async () => {
      const res  = await fetch(`${BASE}/socket.io/?EIO=4&transport=polling`);
      const body = await res.text();
      assert(res.ok && body.startsWith('0{'), `resposta inesperada: ${res.status} ${body.slice(0, 60)}`);
    });

    const servesFrontend = urlArg || existsSync(join(ROOT, 'frontend', 'dist', 'index.html'));
    if (servesFrontend) {
      await check('frontend servido (/ e rota do React Router)', async () => {
        for (const path of ['/', '/doctor/dashboard']) {
          const res = await fetch(`${BASE}${path}`);
          const html = await res.text();
          assert(res.ok && html.includes('id="root"'), `${path} não devolveu o index.html (${res.status})`);
        }
      });

      await check('rota de API inexistente dá 404 JSON, não o index.html', async () => {
        for (const path of ['/api', '/api/nao-existe']) {
          const res = await fetch(`${BASE}${path}`);
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
  console.log('\nTudo certo.');
}

main();
