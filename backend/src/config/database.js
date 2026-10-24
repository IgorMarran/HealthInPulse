const { PrismaClient } = require('@prisma/client');

// SQLite aceita um escritor por vez. Com o pool padrão do Prisma, várias
// conexões ao mesmo arquivo disputam o lock e, com ~10 triagens ao mesmo
// tempo (demo logada na feira), estouram o busy timeout de 5 s em 500
// "Operations timed out". connection_limit=1 serializa no processo (fila em
// memória, sem lock). Sem WAL de propósito: com uma conexão só ele não
// ganha nada e o arquivo -wal residual corrompia o `db push --force-reset`.
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

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
module.exports.withSingleConnection = withSingleConnection;
