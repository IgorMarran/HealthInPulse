# HealthInPulse v7

[![CI](https://github.com/IgorMarran/HealthInPulse/actions/workflows/ci.yml/badge.svg)](https://github.com/IgorMarran/HealthInPulse/actions/workflows/ci.yml)

Plataforma acadêmica de saúde digital integrada à pulseira **Care Plus**: o
paciente acompanha sinais vitais em tempo real, recebe metas personalizadas via
triagem com IA e troca **health-coins** por benefícios; o(a) médico(a) tem
painel consolidado, relatórios automáticos, linha do tempo clínica e base
clínica de referência.

> Aplicação **demo/acadêmica**. Não usar com dados reais de pacientes.

---

## Stack

| Camada       | Tecnologia                                                 |
|--------------|------------------------------------------------------------|
| Backend      | Node 20 · Express 4 · Prisma 5 · SQLite · Socket.io · JWT  |
| Frontend     | React 18 · Vite 5 · Tailwind 3 · React Router 6 · Recharts |
| IA           | OpenAI GPT-4o (opcional) · fallback local (`aiSimulator`)  |
| Auth         | JWT access + refresh com rotação                           |

---

## Como rodar

Escolha um caminho. Os três chegam no mesmo app, com os dados de demonstração.

| Você quer...                       | Caminho                                         | Precisa instalar |
|------------------------------------|-------------------------------------------------|------------------|
| programar sem instalar nada no PC  | [A. GitHub Codespaces](#a-github-codespaces)    | nada (navegador) |
| programar na sua máquina           | [B. Local](#b-local)                            | Node 20+ e Git   |
| só ver o app funcionando           | [C. Docker ou demo online](#c-só-ver-o-app)     | Docker (ou nada) |

### A. GitHub Codespaces

Melhor caminho se o Prisma não instala no seu PC (rede da faculdade, antivírus,
Windows travando arquivo).

1. No repositório no GitHub: **Code → Codespaces → Create codespace on main**.
2. Espere a criação. O `npm run setup` roda sozinho (uns 2 minutos na primeira vez).
3. No terminal do Codespace: `npm run dev`
4. Abra a aba **Ports** e clique no globo da porta **5173** ("App").

Conta pessoal do GitHub tem uma cota grátis de horas por mês (maior com o
GitHub Student Developer Pack). Quando terminar: **Codespaces → Stop**.

### B. Local

Pré-requisitos: **Node.js 20 ou mais novo** (o LTS de https://nodejs.org serve)
e **Git**. Não precisa de Postgres nem de Docker: o banco é SQLite, em arquivo.

```bash
git clone https://github.com/IgorMarran/HealthInPulse.git
cd HealthInPulse
npm run setup     # instala tudo, cria backend/.env, cria o banco e popula a demo
npm run dev       # sobe API (:3000) + frontend (:5173) no mesmo terminal
```

Abra **http://localhost:5173**. `Ctrl+C` para os dois.

**No Windows**, duas coisas evitam quase todos os problemas:

- rode os comandos no **Prompt de Comando (cmd)** ou no **Git Bash**. O
  PowerShell (padrão do terminal do VS Code) pode bloquear o `npm`; veja o
  [Troubleshooting](#troubleshooting). No VS Code: seta ao lado do **+** do
  terminal → **Command Prompt**;
- clone **fora do OneDrive**, por exemplo em `C:\dev`. A pasta Documentos
  costuma ser sincronizada pelo OneDrive, que trava arquivos durante o setup:

```bat
mkdir C:\dev
cd C:\dev
git clone https://github.com/IgorMarran/HealthInPulse.git
cd HealthInPulse
npm run setup
npm run dev
```

O que o `npm run setup` faz:

- confere a versão do Node;
- cria o `backend/.env` com segredos JWT aleatórios. Se você já tinha um `.env`
  copiado do exemplo antigo (Postgres, `sk-...`), ele conserta e avisa;
- instala as dependências da raiz, do backend e do frontend com `npm ci`
  (versões exatas do lockfile, iguais em todas as máquinas);
- gera o Prisma Client, cria o banco SQLite e popula os dados da demo;
- pode rodar de novo sem medo: não apaga seus dados. Para zerar o banco existe
  o `npm run db:reset`.

Rode o `npm run setup` de novo depois de um `git pull` que mexa em
`package.json` ou no `schema.prisma`.

`OPENAI_API_KEY` é opcional. Vazia, a triagem usa o simulador local
(determinístico, por palavras-chave), bom para apresentar offline. Para usar o
GPT-4o, cole uma chave real no `backend/.env` e reinicie o `npm run dev`.

### C. Só ver o app

**Docker** (não precisa de Node):

```bash
docker compose up --build
```

Abra **http://localhost:3000**. É um container só: API, tempo real e o build do
frontend na mesma porta. O banco fica num volume e sobrevive a restarts.

**Demo online grátis (Render).** O `render.yaml` já descreve o serviço; o dono
do repositório configura uma vez: em render.com, **New → Blueprint**, escolhe
este repositório e **Apply**. O Render pede dois valores:

- `DEMO_PASSWORD`: **a senha da turma**. Quem abrir o link digita essa senha
  uma vez (vale por 30 dias naquele navegador) e só então chega na tela de
  login. Sem ela, qualquer pessoa com o link entraria como a médica, porque as
  senhas dos usuários de demo são públicas;
- `OPENAI_API_KEY`: deixe **vazio**. A demo usa o simulador local; com chave
  real, cada triagem feita no link gasta a sua conta da OpenAI.

Depois disso, cada push na `main` faz deploy sozinho. Para trocar a senha da
turma: painel do Render → serviço → **Environment**. No plano grátis:

- o serviço dorme após 15 min sem acesso, e o primeiro acesso leva ~1 min.
  Abra o link uns minutos antes de apresentar;
- o disco é apagado a cada deploy/restart, e o banco volta para os dados da
  demo. Para a apresentação isso é bom: sempre começa limpo.

Para conferir o deploy: `npm run smoke -- --url=https://SEU-APP.onrender.com --demo-password=SENHA`.

---

## Credenciais demo

A tela de login tem **3 cards "Demo · clique para entrar"** que logam
diretamente. Ou digite manualmente:

| Perfil                        | E-mail                          | Senha         | Tipo                                       |
|------------------------------|---------------------------------|---------------|--------------------------------------------|
| 🩺 **João Carlos Mendes**     | `joao@healthinpulse.dev`        | `Joao@123`    | Paciente · caso grave (HAS + DM2)          |
| ✨ **Marina Azevedo Lima**    | `marina@healthinpulse.dev`      | `Marina@123`  | Paciente · preventivo (pré-diabetes)       |
| 🧑‍⚕️ **Dra. Ana Beatriz Souza** | `doctor@healthinpulse.dev`      | `Doctor@123`  | Médica · vinculada aos 2 pacientes acima   |

---

## Scripts disponíveis

### Raiz (use estes no dia a dia)

| Comando             | O que faz                                                                  |
|---------------------|----------------------------------------------------------------------------|
| `npm run setup`     | Prepara tudo: dependências, `.env`, banco e dados da demo                  |
| `npm run dev`       | API + frontend juntos, com hot reload                                      |
| `npm run db:reset`  | Apaga o banco e recria os dados da demo                                    |
| `npm run db:studio` | Abre o Prisma Studio (GUI do banco) em :5555                               |
| `npm run build`     | Build de produção do frontend em `frontend/dist/`                          |
| `npm start`         | Sobe só o backend; com `frontend/dist/` presente, serve o app em :3000     |
| `npm run smoke`     | Teste de fumaça: sobe o backend e testa login e dashboards dos 3 usuários  |

### Backend (`/backend`)

| Comando            | O que faz                                                |
|--------------------|----------------------------------------------------------|
| `npm run dev`      | Sobe o servidor em modo dev (nodemon)                    |
| `npm start`        | Sobe o servidor em modo produção                         |
| `npm run db:generate` | Regenera o Prisma Client                              |
| `npm run db:migrate`  | Cria migration (em SQLite preferimos `prisma db push`)|
| `npm run db:studio`   | Abre o Prisma Studio (GUI do banco) em :5555          |
| `npm run db:seed`     | Popula o banco com dados demo                         |
| `npm run db:reset`    | Reseta migrations (use só se houver migrations)       |

Para resetar o banco e re-popular do zero, use `npm run db:reset` na raiz.

### Frontend (`/frontend`)

| Comando         | O que faz                                |
|-----------------|------------------------------------------|
| `npm run dev`     | Sobe Vite em modo dev (hot reload)       |
| `npm run build`   | Build de produção em `dist/`             |
| `npm run preview` | Serve o build de produção localmente     |

---

## Estrutura de pastas (resumo)

```
HealthInPulse/
├── .devcontainer/              # ambiente do GitHub Codespaces
├── .github/workflows/ci.yml    # CI: setup + smoke em Windows, macOS e Linux
├── scripts/
│   ├── setup.mjs               # npm run setup / db:reset
│   └── smoke.mjs               # npm run smoke
├── docker/entrypoint.sh        # prepara o banco ao subir o container
├── Dockerfile                  # imagem única (API + frontend)
├── docker-compose.yml          # docker compose up
├── render.yaml                 # deploy grátis no Render
├── package.json                # scripts de raiz
├── backend/
│   ├── src/
│   │   ├── app.js              # Express app (middlewares + rotas)
│   │   ├── server.js           # bootstrap HTTP + Socket.io
│   │   ├── config/             # database, jwt, socket, multer
│   │   ├── middlewares/        # auth, validation, errors
│   │   ├── controllers/        # camada HTTP
│   │   ├── services/           # regras de negócio
│   │   ├── routes/             # rotas Express
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # schema do banco
│   │   │   ├── seed.js         # dados demo
│   │   │   └── dev.db          # SQLite (gitignored)
│   │   ├── utils/              # logger, jsonField (helpers SQLite)
│   │   └── uploads/            # arquivos enviados (gitignored)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx            # entrypoint
│   │   ├── index.css           # tailwind + design system
│   │   ├── contexts/           # AuthContext, SocketContext
│   │   ├── hooks/              # useFetch, useLiveVitals, useCountUp...
│   │   ├── services/           # cliente axios + chamadas por domínio
│   │   ├── routes/             # AppRoutes + Guards
│   │   ├── components/layout/  # PatientLayout, DoctorLayout
│   │   └── pages/
│   │       ├── auth/           # Login, Register
│   │       ├── patient/        # Dashboard, Goals, Rewards, Exams...
│   │       └── doctor/         # Dashboard, Patients, Wearable, Reports...
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
├── Docs/                       # docx de pacientes-demo e referência clínica
├── ARCHITECTURE.md             # como o sistema está montado
├── BUSINESS_RULES.md           # regras de negócio detalhadas
└── README.md                   # este arquivo
```

---

## Troubleshooting

**❌ "Token expirado / inválido" depois de muitos refreshes**
Limpe o `localStorage` no DevTools (F12 → Application → Storage → Clear site
data) e faça login de novo. O refresh-token rotation pode ter sido invalidado
após reset do banco.

**❌ "Muitas tentativas. Tente novamente em 15 minutos"**
É o `express-rate-limit` no `/api/auth`, ativo só com `NODE_ENV=production`
(Docker e deploy). O padrão é 30 requisições a cada 15 min por IP, e numa sala
de aula todo mundo sai pelo mesmo IP. Suba o limite com a variável
`AUTH_RATE_LIMIT` (o `render.yaml` já usa 300).

**❌ Dashboard em branco após login**
Quase sempre violação das Regras de Hooks do React. Abra o DevTools (F12 →
Console) e procure por "Rendered fewer hooks than expected". Recarregue com
`Ctrl+Shift+R`.

**❌ Setup falha baixando o Prisma (`binaries.prisma.sh`, `ECONNRESET`, `ETIMEDOUT`, certificado)**
Na instalação o Prisma baixa um "engine" (um programa) da internet. Rede de
faculdade, proxy ou antivírus costumam bloquear esse download. Tente outra rede
(o 4G do celular quase sempre resolve), libere a pasta do projeto no antivírus,
ou use o [Codespaces](#a-github-codespaces). Não precisa trocar o banco por
JSON: o problema é só o download.

**❌ `npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada` (Windows)**
(Em inglês: `npm.ps1 cannot be loaded because running scripts is disabled`.)
É o PowerShell bloqueando o atalho do npm. Use o **Prompt de Comando (cmd)**
ou o **Git Bash**. No VS Code: seta ao lado do **+** do terminal →
**Command Prompt**. Se quiser continuar no PowerShell, troque `npm` por
`npm.cmd` (ex.: `npm.cmd run setup`).

**❌ `EPERM` / `EBUSY` no Windows durante o setup**
Algum arquivo está em uso. Pare o `npm run dev` (`Ctrl+C`), feche o VS Code
nessa pasta e rode `npm run setup` de novo. Se o projeto estiver dentro do
OneDrive (o setup avisa), clone de novo fora dele, ex.: `C:\dev`.

**❌ Backend não sobe — `MODULE_NOT_FOUND`**
Rode `npm run setup` na raiz. Não apague o `package-lock.json`: é ele que
garante as mesmas versões em todas as máquinas.

**❌ Porta 3000 ou 5173 em uso**
Já tem outro `npm run dev` (ou o `docker compose`) rodando. Feche o outro
terminal ou rode `docker compose down`.

**❌ Prisma diz "schema.prisma not found"**
O `package.json` do backend aponta `prisma.schema` para
`src/prisma/schema.prisma`. Rode os comandos `npx prisma ...` **dentro de
`backend/`**.

**❌ "Argument `take`: Expected Int, provided String"**
Significa que algum endpoint paginado não normalizou `req.query.limit` para
número. Já corrigido em todos os services atuais, mas se voltar a ocorrer,
basta envolver em `Number(...)`.

**❌ Erro 401 em todas as chamadas, mesmo após login**
Confira no DevTools → Network se o backend está rodando em
`http://localhost:3000` e se o `Authorization: Bearer ...` está sendo
enviado. O Vite faz proxy via `/api`.

---

## Próximas leituras

- [ARCHITECTURE.md](./ARCHITECTURE.md) — como o sistema está organizado em
  camadas, fluxos principais e modelo de dados
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) — regras de negócio detalhadas do
  backend (autenticação, gamificação, triagem IA, sinais vitais, etc.)

---

## Licença e uso

Projeto **acadêmico** para apresentação à **Care Plus**. Pacientes, exames e
dados clínicos são fictícios. Nenhuma decisão médica deve ser tomada com base
nesta aplicação.
