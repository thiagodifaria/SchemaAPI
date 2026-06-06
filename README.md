# SchemaAPI

![SchemaAPI](https://img.shields.io/badge/SchemaAPI-Document%20Intelligence-111827?style=for-the-badge&logo=databricks&logoColor=white)

**SchemaAPI is a document intelligence platform for local ingestion, structured extraction, hybrid retrieval, cited RAG, lightweight GraphRAG, governance checks, observability and a desktop control plane.**

[![Version](https://img.shields.io/badge/Version-1.0.0-2563EB?style=flat)](README.md)
[![Rust](https://img.shields.io/badge/Rust-API-000000?style=flat&logo=rust&logoColor=white)](service-api/service-rust)
[![Python](https://img.shields.io/badge/Python-workers-3776AB?style=flat&logo=python&logoColor=white)](service-api/service-python)
[![Electron](https://img.shields.io/badge/Electron-desktop-47848F?style=flat&logo=electron&logoColor=white)](client-desktop)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=flat&logo=postgresql&logoColor=white)](service-api/service-postgresql)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-async%20jobs-FF6600?style=flat&logo=rabbitmq&logoColor=white)](infra)
[![Runtime](https://img.shields.io/badge/Runtime-Docker%20Compose-2496ED?style=flat&logo=docker&logoColor=white)](infra)
[![License](https://img.shields.io/badge/License-MIT-success?style=flat)](LICENSE)

The project combines a Rust API, Python document workers, PostgreSQL with pgvector, RabbitMQ and an Electron/React desktop application. It is organized as a Docker-first repository so the backend, database migrations and desktop shell can be operated from the same local workspace.

---

## Documentation / Documentacao

**Leia em Portugues:** [README_PT.md](README_PT.md)  
**Read the detailed English README:** [README_EN.md](README_EN.md)  
**Architecture:** [docs/ARQUITETURA.md](docs/ARQUITETURA.md)  
**API:** [docs/API.md](docs/API.md)  
**Operations:** [docs/OPERACOES.md](docs/OPERACOES.md)  
**Contracts:** [docs/contracts](docs/contracts)

---

## Visual Preview

### Dashboard

![SchemaAPI dashboard](docs/assets/images/dashboard.png)

### RAG

![SchemaAPI RAG view](docs/assets/images/rag.png)

### Analysis

![SchemaAPI analysis view](docs/assets/images/analise.png)

The project follows a service-oriented layout:

- `client-desktop`: Electron, React and Vite desktop control plane.
- `service-api/service-rust`: Actix API, request handlers, retrieval, RAG orchestration and PostgreSQL access.
- `service-api/service-python`: parsing, chunking, embeddings, extraction workers, analytics worker and vectorization API.
- `service-api/service-postgresql`: PostgreSQL and pgvector migrations.
- `infra`: Docker Compose runtime.
- `scripts`: local operational commands.
- `docs`: architecture, operations, API contracts and screenshots.
- `tests`: end-to-end validation for the document workflow.

## Main Capabilities

- Document upload and URL ingestion through the Rust API and desktop app.
- Asynchronous processing through RabbitMQ workers.
- PDF, DOCX, plain text, CSV and spreadsheet ingestion paths.
- Structured parsing with sections, tables, layout metadata and multimodal block records.
- Semantic chunks with `all-MiniLM-L6-v2` embeddings stored in pgvector.
- PostgreSQL lexical search, vector search and hybrid search.
- RAG answers with citations, audit records and evidence warnings.
- Lightweight graph context from extracted entities, mentions and relationships.
- Extraction of summaries, action items, topics, classifications, financial KPIs, risk analysis, legal clauses and tabular summaries.
- Local PII redaction, chunk role metadata and governance audit views.
- Deterministic RAG evaluation records for observability.
- Controlled agent runs with approval flow for sensitive tools.
- Desktop screens for documents, search, RAG, analysis reports, governance, agents and observability.

## Quick Start

Run the local stack and desktop app:

```bash
./scripts/build.sh
```

Run without opening the desktop window:

```bash
./scripts/build.sh --no-desktop
```

Run smoke tests against the Docker stack:

```bash
./scripts/test.sh smoke
```

## Container Stack

Main services:

- Rust API: `http://localhost:8081`
- Python vectorization API: `http://localhost:8001`
- RabbitMQ management UI: `http://localhost:15672`
- PostgreSQL: `localhost:5432`

Useful commands:

```bash
./scripts/build.sh ps
./scripts/build.sh logs
./scripts/build.sh down
./scripts/build.sh contracts
```

## Configuration

Create or edit `.env` in the repository root. The local defaults mirror `.env.example`:

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=schema_api_db

DATABASE__URL=postgres://admin:password123@postgres:5432/schema_api_db
RABBITMQ__URL=amqp://guest:guest@rabbitmq:5672/%2f
API__HOST=0.0.0.0
API__PORT=8081
```

## Build and Run

This repository is intended to be built locally with Docker Compose through the project scripts. Use `./scripts/build.sh` for the full local stack and desktop app, or `./scripts/build.sh --no-desktop` when only the backend services should be rebuilt.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Contact

Thiago Di Faria - [thiagodifaria@gmail.com](mailto:thiagodifaria@gmail.com)

Project link: [https://github.com/thiagodifaria/SchemaAPI](https://github.com/thiagodifaria/SchemaAPI)
