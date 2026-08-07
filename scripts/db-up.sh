#!/usr/bin/env bash
# Arranca PostgreSQL en Docker (WSL) e inicializa la BD.
# Uso: ./scripts/db-up.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no encontrado en WSL. ¿Está el servicio arrancado?"
  exit 1
fi

echo ">> Arrancando PostgreSQL (puerto 5433, volumen nere_pg_data)..."
docker-compose up -d

echo ">> Esperando a que PostgreSQL esté listo..."
for i in $(seq 1 30); do
  if docker-compose exec -T db pg_isready -U postgres -d nere_studio >/dev/null 2>&1; then
    echo ">> PostgreSQL listo."
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "Timeout esperando PostgreSQL."
    exit 1
  fi
done

cd backend
npm run db:init

echo ""
echo "Base de datos lista en localhost:5433/nere_studio"
