# Operations

SchemaAPI is Docker-first. The official local commands live in `scripts/` and use `.sh` because the current workflow is intended to run from Git Bash or a compatible shell on Windows.

## Runtime Commands

```bash
./scripts/build.sh
./scripts/build.sh --keep-data
./scripts/build.sh --no-desktop
./scripts/build.sh backend
./scripts/build.sh desktop
./scripts/build.sh ps
./scripts/build.sh logs
./scripts/build.sh down
./scripts/build.sh clean
./scripts/build.sh contracts
```

`./scripts/build.sh` is the main local runtime command. By default it:

1. Stops the Compose stack.
2. Removes project volumes unless `--keep-data` is used.
3. Prunes Docker build/cache leftovers unless `--no-prune` is used.
4. Rebuilds and starts the backend stack.
5. Waits for `http://localhost:8081/health`.
6. Builds the desktop bundle.
7. Opens the Electron desktop app unless `--no-desktop` is used.

The script also cleans the Vite desktop port and Schema API Electron process before opening the desktop. This avoids stale port `5173` failures during repeated local runs.

## Tests

```bash
./scripts/test.sh smoke
./scripts/test.sh e2e
./scripts/test.sh contract
./scripts/test.sh desktop
./scripts/test.sh unit
./scripts/test.sh integration
```

The smoke/e2e path starts the Docker stack and runs `tests/e2e_tests` in a Python container attached to the Compose network.

Manual checks:

```bash
curl http://localhost:8081/health
curl http://localhost:8081/agents/tools
curl -X POST http://localhost:8081/governance/pii/redact \
  -H "Content-Type: application/json" \
  -d '{"text":"Contato maria@example.com CPF 123.456.789-00"}'
```

## Services

| Service | URL |
|---------|-----|
| Rust API | `http://localhost:8081` |
| Python vectorization API | `http://localhost:8001` |
| RabbitMQ UI | `http://localhost:15672` |
| PostgreSQL | `localhost:5432` |

## Desktop

The desktop app is the primary local control plane:

```bash
./scripts/build.sh
```

Recommended visual validation:

1. Open the desktop.
2. Use `Selecionar documentos` or `Upload`.
3. Wait until the document reaches a final status.
4. Validate hybrid search, RAG, analysis, governance, agents and observability.
5. Do not upload SchemaAPI-generated reports as source documents; the worker rejects them to prevent generated output from becoming evidence.

Desktop-only build check:

```bash
./scripts/test.sh desktop
```

## Migrations

Migrations live in `service-api/service-postgresql/migrations` and are applied by the `migrations` service in Docker Compose. The migration runner records applied filenames in `schema_migrations`.

## Configuration

`.env.example` documents the local defaults:

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=schema_api_db

DATABASE__URL=postgres://admin:password123@postgres:5432/schema_api_db
RABBITMQ__URL=amqp://guest:guest@rabbitmq:5672/%2f
API__HOST=0.0.0.0
API__PORT=8081
```

## Generated Artifacts

The following paths are generated locally and must stay out of version control:

- `client-desktop/node_modules`
- `client-desktop/dist`
- `client-desktop/dist-electron`
- `service-api/service-rust/target`
- `.pytest_cache`
- `__pycache__`

Screenshots used by the documentation belong in `docs/assets/images`.

## Local Build

The supported local build path is Docker Compose through `scripts/build.sh`.

```bash
./scripts/build.sh
```

For backend-only rebuilds:

```bash
./scripts/build.sh --no-desktop
```

The script rebuilds the Compose services, applies migrations, waits for the Rust API health endpoint and then builds/opens the Electron desktop when enabled.

## Troubleshooting

- API unavailable: run `./scripts/build.sh logs rust-core`.
- Documents stuck in processing: run `./scripts/build.sh logs python-worker`.
- Search or RAG returning no source chunks: confirm a real source document, not a generated SchemaAPI report, was uploaded.
- Desktop port already in use: rerun `./scripts/build.sh`; the script attempts to clean port `5173` before starting Vite.
- RabbitMQ not ready: inspect `./scripts/build.sh ps` and RabbitMQ UI at `http://localhost:15672`.

The DevTools messages about Autofill or language mismatch are Chromium DevTools noise and are not API failures.
