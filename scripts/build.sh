#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
CLIENT_DIR="$ROOT_DIR/client-desktop"
DOCKER_COMPOSE_FILE="$COMPOSE_FILE"

if command -v cygpath >/dev/null 2>&1; then
  DOCKER_COMPOSE_FILE="$(cygpath -w "$COMPOSE_FILE")"
fi

cmd="all"
keep_data=0
open_desktop=1
prune=1
passthrough_args=""
vite_pid=""

for arg in "$@"; do
  case "$arg" in
    all|backend|desktop|contracts|down|ps|logs|clean|prune)
      cmd="$arg"
      ;;
    --keep-data)
      keep_data=1
      ;;
    --no-desktop)
      open_desktop=0
      ;;
    --no-prune)
      prune=0
      ;;
    -h|--help)
      cmd="help"
      ;;
    *)
      passthrough_args="$passthrough_args $arg"
      ;;
  esac
done

compose() {
  MSYS_NO_PATHCONV=1 docker compose -f "$DOCKER_COMPOSE_FILE" "$@"
}

cleanup_desktop_processes() {
  if [ -n "${vite_pid:-}" ]; then
    kill "$vite_pid" >/dev/null 2>&1 || true
    wait "$vite_pid" >/dev/null 2>&1 || true
    vite_pid=""
  fi

  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
      Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | \
        Select-Object -ExpandProperty OwningProcess -Unique | \
        ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }; \
      Get-Process electron -ErrorAction SilentlyContinue | \
        Where-Object { \$_.MainWindowTitle -eq 'Schema API' -or \$_.Path -like '*SchemaAPI*' } | \
        Stop-Process -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:5173 | xargs -r kill -9 >/dev/null 2>&1 || true
  fi
}

trap cleanup_desktop_processes EXIT
trap 'cleanup_desktop_processes; exit 130' INT TERM

install_desktop_deps() {
  cd "$CLIENT_DIR"
  if [ ! -d node_modules ]; then
    npm install
  else
    npm install
  fi
}

build_desktop() {
  install_desktop_deps
  cd "$CLIENT_DIR"
  npm run build
}

start_desktop() {
  unset ELECTRON_RUN_AS_NODE || true
  install_desktop_deps
  cd "$CLIENT_DIR"

  cleanup_desktop_processes

  npm run build:electron
  npm exec vite -- --host 127.0.0.1 &
  vite_pid="$!"

  i=0
  while [ "$i" -lt 60 ]; do
    if curl -fsS http://127.0.0.1:5173 >/dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 1
  done

  if [ "$i" -ge 60 ]; then
    echo "Desktop dev server did not become available at http://127.0.0.1:5173"
    return 1
  fi

  npm exec electron -- .
}

reset_backend() {
  if [ "$keep_data" -eq 1 ]; then
    compose down --remove-orphans
  else
    compose down --volumes --remove-orphans
  fi

  if [ "$prune" -eq 1 ]; then
    docker system prune -f
    docker builder prune -f
  fi
}

start_backend() {
  compose up -d --build
}

wait_backend() {
  printf "Waiting for API health"
  i=0
  while [ "$i" -lt 90 ]; do
    if curl -fsS http://localhost:8081/health >/dev/null 2>&1; then
      echo " OK"
      return 0
    fi
    i=$((i + 1))
    printf "."
    sleep 2
  done
  echo
  echo "API did not become healthy at http://localhost:8081/health"
  compose ps
  return 1
}

contracts_check() {
  test -f "$ROOT_DIR/docs/contracts/http/schemaapi.openapi.yaml"
  test -f "$ROOT_DIR/docs/contracts/registry.json"
  test -f "$ROOT_DIR/docs/contracts/events/rag.query-executed.schema.json"
  test -f "$ROOT_DIR/docs/contracts/events/rag.eval-created.schema.json"
  echo "Contract files are present."
}

case "$cmd" in
  all)
    reset_backend
    start_backend
    wait_backend
    build_desktop
    if [ "$open_desktop" -eq 1 ]; then
      start_desktop
    fi
    ;;
  backend)
    reset_backend
    start_backend
    wait_backend
    ;;
  desktop)
    build_desktop
    start_desktop
    ;;
  contracts)
    contracts_check
    ;;
  down)
    compose down --remove-orphans
    ;;
  clean)
    keep_data=0
    reset_backend
    ;;
  prune)
    docker system prune -f
    docker builder prune -f
    ;;
  ps)
    compose ps
    ;;
  logs)
    # shellcheck disable=SC2086
    compose logs -f $passthrough_args
    ;;
  help|*)
    cat <<'EOF'
Usage:
  ./scripts/build.sh                         clean rebuild backend, build desktop and open app
  ./scripts/build.sh --keep-data             rebuild keeping database volume
  ./scripts/build.sh --no-desktop            rebuild backend and desktop bundle without opening app
  ./scripts/build.sh backend [--keep-data]   rebuild only Docker backend
  ./scripts/build.sh desktop                 build and open Electron desktop
  ./scripts/build.sh contracts               validate contract files
  ./scripts/build.sh ps|logs|down|clean|prune
EOF
    ;;
esac
