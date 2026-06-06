# API

Local base URL: `http://localhost:8081`

The OpenAPI contract lives at [docs/contracts/http/schemaapi.openapi.yaml](contracts/http/schemaapi.openapi.yaml). Event contracts live under [docs/contracts/events](contracts/events).

## Conventions

- Long-running ingestion operations return `202 Accepted`.
- Document processing is asynchronous; clients should poll `/documents/{id}`.
- Search endpoints return chunks and ranking metadata.
- RAG responses should include citations or an insufficient-evidence warning.
- Some endpoints return `404` when no latest operational record exists, for example the latest RAG evaluation.
- Generated SchemaAPI report artifacts are rejected as source documents and should not be used as primary evidence.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API health check |

## Documents

| Method | Path | Description |
|--------|------|-------------|
| POST | `/documents/upload` | Upload a file for asynchronous processing |
| POST | `/documents/url` | Ingest a document from a URL |
| GET | `/documents/{id}` | Read the latest processing version for a document |
| GET | `/documents/{id}/graph` | Read the document graph |
| GET | `/documents/{id}/diff` | Read version diff information for a document |
| GET | `/documents/{id}/multimodal` | Read multimodal/layout blocks for the latest version |

Upload accepts `multipart/form-data` with a `file` part and optional metadata. URL ingestion accepts JSON with a `url` field.

## Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/search` | Semantic vector search |
| POST | `/search/lexical` | PostgreSQL full-text search |
| POST | `/search/hybrid` | Hybrid semantic and lexical search |

Typical request:

```json
{
  "query": "EBITDA ajustado",
  "limit": 10,
  "actor_role": "reader"
}
```

## RAG

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rag/query` | Ask a question over retrieved document evidence |

Typical request:

```json
{
  "query": "Houve crescimento ou queda de receita liquida?",
  "limit": 8,
  "actor_role": "reader"
}
```

The response contains the answer, citations and supporting fields used by the desktop app.

## Analysis

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analysis/reports` | Create an analysis report from selected documents and questions |
| GET | `/analysis/reports` | List analysis reports |
| GET | `/analysis/reports/{id}` | Read one analysis report |
| GET | `/analysis/reports/{id}/export` | Export an analysis report |

Analysis reports are generated artifacts. They are useful as output, but should not be reuploaded as source documents for retrieval.

## Governance

| Method | Path | Description |
|--------|------|-------------|
| POST | `/feedback` | Submit correction or feedback data |
| POST | `/governance/pii/redact` | Redact local PII patterns from text |
| GET | `/governance/audit` | List recent audit events |

PII redaction request:

```json
{
  "text": "Contato maria@example.com CPF 123.456.789-00"
}
```

## Observability

| Method | Path | Description |
|--------|------|-------------|
| POST | `/observability/rag/evaluate` | Evaluate the latest audited RAG query |
| GET | `/observability/rag/latest` | Read the latest RAG evaluation |
| GET | `/observability/rag/history` | List recent RAG evaluations |

The evaluator exposes operational metrics used by the app: faithfulness, context precision, answer alignment and source adherence.

## Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/agents/tools` | List registered agent tools |
| POST | `/agents/runs` | Create a controlled agent run |
| GET | `/agents/runs/{id}` | Read an agent run |
| POST | `/agents/runs/{id}/approve` | Approve a sensitive agent run |

Agent run request:

```json
{
  "goal": "Verificar discrepancia documental",
  "requested_tool": "compare_invoice_purchase_order"
}
```

## Contexts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/contexts/auto` | List automatic contexts inferred from indexed documents |

## Vectorization Service

The Python vectorization API runs at `http://localhost:8001` inside the local stack. It is an internal service used by the Rust API for embeddings and relevance features.
