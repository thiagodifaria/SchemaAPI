# SchemaAPI - Document Intelligence Platform

SchemaAPI is a local document intelligence platform for ingestion, structured extraction, hybrid retrieval, cited RAG, lightweight GraphRAG, governance, observability and desktop operation.

The project is organized as a service-oriented application. The desktop client lives in `client-desktop`, backend capabilities live in `service-api`, migrations live in `service-api/service-postgresql`, infrastructure files live in `infra`, operational commands live in `scripts` and technical documentation lives in `docs`.

The application runs locally through Docker Compose. The backend uses a Rust Actix API, Python document workers, PostgreSQL with pgvector, RabbitMQ and an Electron/React desktop application.

## Repository Layout

```text
client-desktop/
  electron/
  src/
  package.json

service-api/
  service-rust/
    src/api/
    src/domain/
    src/infrastructure/
  service-python/
    src/extract/
    src/learn/
    src/model/
    src/template/
    src/worker.py
    src/server.py
  service-postgresql/
    migrations/

infra/
  docker-compose.yml

scripts/
tests/
docs/
```

## Features

- Document upload and URL ingestion.
- Asynchronous document processing through RabbitMQ.
- PDF, DOCX, plain text, CSV and spreadsheet paths implemented in the Python worker.
- Document parsing with text blocks, sections, tables, detected images and layout metadata.
- Contextual semantic chunking with raw text, clean text and search context.
- Embeddings with `all-MiniLM-L6-v2` stored in pgvector.
- Vector search, PostgreSQL full-text search and hybrid search.
- RAG answers with citations, audit records and evidence warnings.
- Lightweight graph context from extracted entities, mentions and relationships.
- Summary, topic, classification, action item, financial KPI, risk, legal clause and table extraction.
- Multimodal/layout block records for detected tables, images and sections.
- Local PII redaction and audit trail.
- Deterministic RAG evaluations for observability.
- Controlled agent runs with approval flow.
- API-generated analysis reports with export support.
- Desktop application for documents, dashboard, hybrid search, RAG, analysis, governance, agents and observability.

## Application Surfaces

SchemaAPI exposes the document engine through three practical surfaces:

- The Rust API in `service-api/service-rust`, responsible for upload, lookup, search, RAG, governance, agents, analysis and PostgreSQL access.
- Python processes in `service-api/service-python`, responsible for parsing, chunking, embeddings, extraction, asynchronous analytics and vectorization.
- The desktop control plane in `client-desktop`, used to operate the local backend without manual HTTP calls.

This split keeps the API as the public boundary, leaves heavier processing in Python workers and concentrates day-to-day operation in the desktop app.

## Document Pipeline

The main data flow is:

1. The API receives a file through `/documents/upload` or a URL through `/documents/url`.
2. The API stores metadata, the raw file and a processing version in PostgreSQL.
3. The API publishes the job to RabbitMQ.
4. The Python worker loads the raw file, selects the proper parser and creates structured blocks.
5. The worker rejects SchemaAPI-generated report artifacts when they are uploaded as source material, preventing exported reports from being reindexed as primary evidence.
6. The chunker creates contextual chunks with section, page, content type and layout metadata.
7. The worker calculates embeddings and extracts topics, classifications, action items, graph data, KPIs, risks and tables.
8. The API reads persisted tables for document status, search, RAG, graph, analysis and observability.

## Retrieval and RAG

Semantic search uses embeddings stored in pgvector. Lexical search uses PostgreSQL `tsvector`. Hybrid search combines semantic and lexical signals, adds evidence-oriented presentation and returns warnings when the API has to explain missing source material.

The `/rag/query` endpoint retrieves context, applies role filters when provided and builds an answer with citations. When the retrieved evidence does not support the question, the system should prefer an insufficient-evidence answer over filling gaps.

GraphRAG is lightweight in this stage: the system uses extracted entities, mentions and relationships to enrich context, without claiming deep graph reasoning or external inference.

## Governance, Agents and Observability

Governance includes local pattern-based PII redaction, access metadata on chunks and audit event lookup. The agent runtime exposes registered tools, classifies operational risk and requires approval for sensitive runs.

RAG observability records audited queries and deterministic evaluations with internal metrics such as faithfulness, context precision, answer alignment and source adherence. These values are operational readings from the built-in evaluator, not external benchmarks.

## Desktop

The desktop app lives in `client-desktop` and uses Electron, React, Vite and TypeScript. It talks to the local API at `http://localhost:8081` and provides screens for:

1. Health, document and evidence dashboard.
2. Session documents and processing inspector.
3. Hybrid search.
4. RAG.
5. Analysis reports.
6. Governance.
7. Agents.
8. Observability.

## Installation and Runtime

The recommended path is Docker-first:

```bash
./scripts/build.sh
```

Rebuild without opening the desktop window:

```bash
./scripts/build.sh --no-desktop
```

Preserve PostgreSQL data:

```bash
./scripts/build.sh --keep-data
```

Local services:

- Rust API: `http://localhost:8081`
- Python vectorization API: `http://localhost:8001`
- RabbitMQ UI: `http://localhost:15672`
- PostgreSQL: `localhost:5432`

## Configuration

Create or adjust `.env` in the repository root. Local defaults are documented in `.env.example`.

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=schema_api_db

DATABASE__URL=postgres://admin:password123@postgres:5432/schema_api_db
RABBITMQ__URL=amqp://guest:guest@rabbitmq:5672/%2f
API__HOST=0.0.0.0
API__PORT=8081
```

## Tests and Validation

The smoke/e2e flow starts the Docker stack, waits for the API, installs test dependencies in a Python container and runs `tests/e2e_tests`.

```bash
./scripts/test.sh smoke
```

Smaller checks:

```bash
./scripts/build.sh contracts
./scripts/test.sh contract
./scripts/test.sh desktop
```

## Screenshots

### Dashboard

![Dashboard](docs/assets/images/dashboard.png)

### RAG

![RAG](docs/assets/images/rag.png)

### Analysis

![Analysis](docs/assets/images/analise.png)

## Build and Local Runtime

This repository should be built and run locally with Docker Compose through the project scripts. Use `./scripts/build.sh` for the full stack with the desktop app, or `./scripts/build.sh --no-desktop` to rebuild only the backend services.

## Operational Boundaries

SchemaAPI is a local document intelligence and operational support platform. It does not replace human review, does not guarantee complete evidence when source documents are incomplete and should not index reports exported by SchemaAPI itself as primary sources. RAG answers must be checked against returned citations.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Contact

Thiago Di Faria - [thiagodifaria@gmail.com](mailto:thiagodifaria@gmail.com)

Project link: [https://github.com/thiagodifaria/SchemaAPI](https://github.com/thiagodifaria/SchemaAPI)
