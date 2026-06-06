# Architecture

SchemaAPI is a Docker-first document intelligence system with a Rust API, Python processing services, PostgreSQL/pgvector persistence, RabbitMQ messaging and an Electron desktop control plane.

## Topology

```text
Desktop / HTTP client
  |
  v
Rust API (Actix)
  |
  +--> PostgreSQL + pgvector
  +--> RabbitMQ
  +--> Python vectorization API
          |
          +--> document worker
          +--> analytics worker
```

## Services

| Service | Stack | Path | Responsibility |
|---------|-------|------|----------------|
| `rust-core` | Rust / Actix | `service-api/service-rust` | Public API, ingestion, retrieval, RAG, governance, agents, analysis and PostgreSQL access |
| `python-worker` | Python | `service-api/service-python` | Document parsing, chunking, embeddings and extraction jobs |
| `python-analytics` | Python | `service-api/service-python` | Template, feedback, temporal and retraining jobs wired through the analytics worker |
| `python-api` | Python / FastAPI | `service-api/service-python` | Query vectorization and relevance scoring endpoints used by the Rust API |
| `postgres` | PostgreSQL + pgvector | `service-api/service-postgresql/migrations` | Documents, raw files, chunks, vectors, graph data, evaluations, agents and reports |
| `rabbitmq` | RabbitMQ | Docker image | Processing queue between the API and workers |
| `client-desktop` | Electron / React | `client-desktop` | Desktop control plane for local operation |

## Repository Boundaries

```text
client-desktop/             desktop shell and renderer
service-api/service-rust/   public API and persistence orchestration
service-api/service-python/ parsing, embeddings, extraction and analytics
service-api/service-postgresql/migrations/
infra/                      Docker Compose runtime
scripts/                    local operational commands
docs/                       architecture, API, operations, contracts and images
tests/                      end-to-end workflow tests
```

## Rust API

The Rust service registers handlers for:

- health checks;
- document upload and URL ingestion;
- document status and graph lookups;
- document diffs and multimodal blocks;
- semantic, lexical and hybrid search;
- RAG queries;
- feedback submission;
- governance redaction and audit lookup;
- RAG evaluation history;
- agent tool listing, run creation, approval and lookup;
- analysis report creation, listing, lookup and export;
- automatic context listing.

PostgreSQL access is centralized in `service-api/service-rust/src/infrastructure/persistence/postgres.rs`, while RabbitMQ publishing lives under `service-api/service-rust/src/infrastructure/messaging`.

## Python Processing

The Python service is organized around the document worker and supporting modules:

```text
service-python/src/
  parse.py       PDF, DOCX, text and URL parsing
  chunk.py       contextual semantic chunking
  worker.py      RabbitMQ document processing worker
  server.py      FastAPI vectorization and relevance API
  analytics.py   async analytics worker
  extract/       action, graph, KPI, table, topic and clause extraction
  model/         summary, risk, classification, legal and NER wrappers
  learn/         feedback, ranking, features, temporal analysis and retraining hooks
  template/      document structure detection, creation and application
```

The worker stores the raw file, parsed structure, chunks, embeddings and extracted records. It also rejects SchemaAPI-generated analysis/report artifacts when they are uploaded as if they were source documents, preventing generated summaries from becoming primary evidence.

## Persistence

PostgreSQL migrations define:

- document and raw file records;
- processing versions;
- chunks with pgvector embeddings and generated full-text search vectors;
- topics, action items, classifications, tabular data and financial KPIs;
- entities, mentions and relationships for graph context;
- legal clauses, risk analysis, templates and review queue tables;
- RAG audit and evaluation tables;
- governance audit events;
- agent runs;
- multimodal blocks;
- analysis reports.

The embedding dimension is 384, matching `all-MiniLM-L6-v2`.

## Retrieval

Retrieval has three public paths:

- `/search`: vector search over chunk embeddings.
- `/search/lexical`: PostgreSQL full-text search.
- `/search/hybrid`: combined retrieval with evidence-oriented presentation.

The API also carries warnings when source material is missing or when generated artifacts would otherwise pollute retrieval.

## RAG and Graph Context

The RAG endpoint retrieves chunks, keeps citations, audits the query and returns an answer. When evidence is insufficient, the intended behavior is to say so explicitly.

GraphRAG is lightweight: graph records from extracted entities, mentions and relationships can enrich context, but the project does not claim external knowledge graph reasoning.

## Governance and Agents

Governance currently includes local PII redaction, access metadata on chunks and audit event retrieval. Agent runs use an approved tool registry and a status flow that can require approval before execution.

## Desktop Control Plane

The desktop application uses Electron for native shell integration and React/Vite for the interface. The renderer calls the local API through Electron IPC handlers. It includes screens for dashboard, documents, hybrid search, RAG, analysis, governance, agents and observability.

## Operational Decisions

- Docker Compose is the official local runtime.
- `service-api` is the backend boundary.
- PostgreSQL is the source of truth for processed documents, chunks, reports and operational records.
- RabbitMQ separates ingestion from processing.
- Python owns model-heavy and parser-heavy work.
- Rust owns the public API boundary and database-backed retrieval.
- Generated SchemaAPI reports must not be reindexed as source documents.
- Generated build artifacts must stay out of version control.
