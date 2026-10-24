const { PrismaClient } = require('@prisma/client');

// SQLite aceita um escritor por vez. Com o pool padrão do Prisma, várias
// conexões ao mesmo arquivo disputam o lock e, com ~10 triagens ao mesmo
// tempo (demo logada na feira), estouram o busy timeout de 5 s em 500
// "Operations timed out". connection_limit=1 serializa no processo (fila em
// memória, sem lock) e o WAL deixa leituras passarem durante uma escrita.
const withSingleConnection = (url) => {
  if (!url || !url.startsWith('file:') || /connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
};

const datasourceUrl = withSingleConnection(process.env.DATABASE_URL);

const prisma = new PrismaClient({
  ...(datasourceUrl && { datasourceUrl }),
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
});

// WAL persiste no arquivo; o PRAGMA é idempotente. Erro aqui não derruba o
// servidor (ex.: banco em sistema de arquivos sem suporte): segue sem WAL.
const enableWal = async () => {
  if (!datasourceUrl?.startsWith('file:')) return;
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=10000');
  } catch (err) {
    console.warn(`[database] não consegui ligar o WAL: ${err.message}`);
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
module.exports.enableWal = enableWal;
module.exports.withSingleConnection = withSingleConnection;
