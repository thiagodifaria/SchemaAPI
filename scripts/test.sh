#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
scope="${1:-smoke}"
PYTEST_ARGS="-v --tb=short --disable-warnings"

DOCKER_ROOT="$ROOT_DIR"
DOCKER_COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
if command -v cygpath >/dev/null 2>&1; then
  DOCKER_ROOT="$(cygpath -w "$ROOT_DIR")"
  DOCKER_COMPOSE_FILE="$(cygpath -w "$ROOT_DIR/infra/docker-compose.yml")"
fi

wait_for_api() {
  printf "Waiting for API inside Docker network"
  i=0
  while [ "$i" -lt 90 ]; do
    if MSYS_NO_PATHCONV=1 docker run --rm --network schema_api_network curlimages/curl:8.8.0 \
      -fsS http://rust-core:8081/health >/dev/null 2>&1; then
      echo " OK"
      return 0
    fi
    i=$((i + 1))
    printf "."
    sleep 2
  done
  echo
  echo "API did not become reachable from schema_api_network."
  MSYS_NO_PATHCONV=1 docker compose -f "$DOCKER_COMPOSE_FILE" ps
  return 1
}

case "$scope" in
  smoke|e2e)
    MSYS_NO_PATHCONV=1 docker compose -f "$DOCKER_COMPOSE_FILE" down --volumes --remove-orphans
    MSYS_NO_PATHCONV=1 docker compose -f "$DOCKER_COMPOSE_FILE" up -d --build
    wait_for_api
    MSYS_NO_PATHCONV=1 docker run --rm \
      --network schema_api_network \
      -e API_URL=http://rust-core:8081 \
      -e DB_HOST=postgres \
      -e POSTGRES_DB=schema_api_db \
      -e POSTGRES_USER=admin \
      -e POSTGRES_PASSWORD=password123 \
      -v "$DOCKER_ROOT:/workspace" \
      -w /workspace \
      python:3.11-slim \
      sh -c "pip install --no-cache-dir -r tests/requirements-test.txt && python -m pytest $PYTEST_ARGS tests/e2e_tests"
    ;;
  contract)
    test -f "$ROOT_DIR/docs/contracts/http/schemaapi.openapi.yaml"
    test -f "$ROOT_DIR/docs/contracts/registry.json"
    test -f "$ROOT_DIR/docs/contracts/events/rag.query-executed.schema.json"
    test -f "$ROOT_DIR/docs/contracts/events/rag.eval-created.schema.json"
    echo "Contract files are present."
    ;;
  desktop)
    cd "$ROOT_DIR/client-desktop"
    npm install
    npm run build
    ;;
  unit|integration)
    MSYS_NO_PATHCONV=1 docker run --rm \
      -v "$DOCKER_ROOT:/workspace" \
      -w /workspace \
      python:3.11-slim \
      sh -c "pip install --no-cache-dir -r tests/requirements-test.txt && python -m pytest $PYTEST_ARGS tests"
    ;;
  *)
    echo "Usage: ./scripts/test.sh {smoke|e2e|contract|desktop|unit|integration}"
    exit 1
    ;;
esac
