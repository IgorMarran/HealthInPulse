#!/bin/sh
# Prepara o banco e sobe o servidor. Roda a cada start do container.
set -e

# Sem segredos JWT o backend não assina token. Na demo, gera na hora; as
# sessões caem a cada restart. Para mantê-las, defina as variáveis no host.
for var in JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  if [ -z "$(printenv "$var")" ]; then
    export "$var=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
    echo "[entrypoint] $var não definido: gerei um temporário"
  fi
done

# Caminho relativo no DATABASE_URL é relativo ao schema.prisma, como no Prisma
db_file="${DATABASE_URL#file:}"
case "$db_file" in
  /*) ;;
  *)  db_file="src/prisma/${db_file#./}" ;;
esac

# SEED_ON_START=true: recria o banco do zero a cada start (demo sempre limpa)
if [ "$SEED_ON_START" = "true" ]; then
  ./node_modules/.bin/prisma db push --skip-generate --force-reset --accept-data-loss
  node src/prisma/seed.js
elif [ ! -f "$db_file" ]; then
  # Banco novo (primeiro start, ou disco efêmero do plano grátis) = dados da demo
  ./node_modules/.bin/prisma db push --skip-generate
  node src/prisma/seed.js
else
  ./node_modules/.bin/prisma db push --skip-generate
fi

exec "$@"
