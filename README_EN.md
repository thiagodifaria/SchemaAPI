# SchemaAPI - Intelligent Document Processing API

API for intelligent processing of documents, texts, transcriptions, PDFs/DOCX, and spreadsheets (CSV/XLSX), transforming them into actionable insights: clear summaries, topics, action items with assignee suggestions and deadlines, categorization, semantic search vectors, relationship graphs, temporal patterns, and tabular reports.

## 🎯 Features

- ✅ **Advanced multilingual processing**: Support for Portuguese, English, Spanish with unified Transformer models
- ✅ **Multi-format support**: PDFs, DOCX, TXT, CSV, XLSX, meeting transcriptions
- ✅ **Intelligent summarization**: Hybrid abstractive/extractive with map-reduce for long documents
- ✅ **Action item extraction**: Smart task detection with assignee and deadline prediction
- ✅ **Knowledge graph construction**: Automatic relationship discovery and entity mapping
- ✅ **Temporal pattern detection**: Trends, anomalies, seasonality, and forecasting
- ✅ **Semantic search**: Vector-based search with HNSW indexing
- ✅ **Continuous learning**: Feedback loops and active learning for model improvement
- ✅ **Vertical specialization**: Customizable for finance, legal, HR domains
- ✅ **Production ready**: Rate limiting, audit trails, versioning, health monitoring

## 🗼 Architecture

Hybrid modular architecture optimizing performance and flexibility:

```
core/               # Rust high-performance processing engine
├── ingestion/      # Document parsing and normalization
├── chunking/       # Intelligent text segmentation
├── indexing/       # Vector storage and search
└── persistence/    # Data storage and versioning

ml-engine/          # Python ML and NLP pipeline
├── summarization/  # Abstractive/extractive summarization
├── extraction/     # Entity and action item extraction
├── classification/ # Multi-label document categorization
├── knowledge/      # Graph construction and analysis
└── temporal/       # Pattern detection and forecasting

api/               # FastAPI web service
├── routes/        # REST endpoints
├── middleware/    # Rate limiting, auth, logging
├── workers/       # Async job processing
└── monitoring/    # Health checks and metrics
```

## 🔧 Technology Stack

### Core Processing
- **Rust**: High-performance document processing, I/O, and indexing
- **Python 3.10+**: ML pipeline and NLP processing
- **FastAPI**: Modern web framework with async support
- **Pydantic v2**: Data validation and serialization

### Machine Learning
- **Transformers (Hugging Face)**: State-of-the-art NLP models
- **SentenceTransformers**: Semantic embeddings for search
- **spaCy**: Named Entity Recognition and linguistic analysis
- **scikit-learn**: Classification and clustering algorithms

### Infrastructure
- **Redis**: High-performance caching and job queuing
- **PostgreSQL**: Primary database with vector extensions
- **HNSW**: Approximate nearest neighbor search
- **Docker**: Complete containerization

### Monitoring & Observability
- **Structured Logging**: JSON logs with correlation IDs
- **Prometheus Metrics**: Performance and business metrics
- **Health Checks**: Component-level health monitoring
- **OpenTelemetry**: Distributed tracing

## 📋 Prerequisites

- Python 3.10+
- Rust 1.70+ (for core development)
- Docker (optional for development, required for production)
- Redis (optional, uses fallback if unavailable)
- 4GB+ RAM for ML models

## 🚀 Installation

### Local Development

```bash
# Clone repository
git clone https://github.com/thiagodifaria/SchemaAPI.git
cd SchemaAPI

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install Python dependencies
pip install -r requirements.txt

# Install Rust dependencies (optional, for core development)
cargo build --release

# Start application
python -m uvicorn app.main:app --reload
```

### With Docker (Recommended)

```bash
# Development environment
docker-compose up --build

# Production environment
docker-compose -f docker-compose.prod.yml up -d
```

## ⚙️ Configuration

### Environment Variables

```env
# Application
SCHEMAAPI_DEBUG=true
SCHEMAAPI_ENVIRONMENT=development
SCHEMAAPI_LOG_LEVEL=INFO

# Processing
SCHEMAAPI_PROCESSING__MAX_FILE_SIZE_MB=100
SCHEMAAPI_PROCESSING__CHUNK_SIZE=512
SCHEMAAPI_PROCESSING__OVERLAP_SIZE=50

# ML Models
SCHEMAAPI_ML__SUMMARIZATION_MODEL=facebook/bart-large-cnn
SCHEMAAPI_ML__EMBEDDING_MODEL=all-MiniLM-L6-v2
SCHEMAAPI_ML__NER_MODEL=en_core_web_sm

# Database
SCHEMAAPI_DATABASE__URL=postgresql://user:pass@localhost:5432/schemaapi
SCHEMAAPI_DATABASE__POOL_SIZE=20

# Cache & Queue
SCHEMAAPI_REDIS__URL=redis://localhost:6379/0
SCHEMAAPI_REDIS__TTL=3600

# Rate Limiting
SCHEMAAPI_RATE_LIMIT__REQUESTS_PER_MINUTE=60
SCHEMAAPI_RATE_LIMIT__REQUESTS_PER_HOUR=500
```

## 📊 API Usage

### Document Processing

```bash
curl -X POST "http://localhost:8000/api/v1/documents/process" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@document.pdf" \
     -F "config={\"summarization\": {\"type\": \"hybrid\", \"length\": \"detailed\"}}"
```

**Response:**
```json
{
  "document_id": "c5d3b066-013b-4a9c-baeb-5f420200f796",
  "processing_status": "completed",
  "metadata": {
    "filename": "document.pdf",
    "file_type": "pdf",
    "pages": 12,
    "word_count": 3420,
    "language": "en",
    "processing_time_ms": 2341.7
  },
  "summary": {
    "text": "Comprehensive quarterly review discussing budget allocation...",
    "type": "hybrid",
    "confidence": 0.89,
    "key_points": [
      "Budget increase of 15% approved",
      "New hiring plan for Q4",
      "Technology upgrade initiatives"
    ]
  },
  "action_items": [
    {
      "id": "action_001",
      "task": "Finalize budget proposal for Q4",
      "assignee": {
        "name": "Maria Silva",
        "email": "maria@company.com",
        "confidence": 0.92
      },
      "due_date": {
        "date": "2025-09-15",
        "confidence": 0.85,
        "source": "explicit"
      },
      "priority": "high",
      "context": "Budget discussion in quarterly review"
    }
  ],
  "topics": [
    {
      "topic": "budget planning",
      "weight": 0.85,
      "type": "decision",
      "related_entities": ["Q4", "finance", "planning"]
    }
  ],
  "classifications": [
    {"label": "financial_document", "score": 0.94},
    {"label": "meeting_minutes", "score": 0.88}
  ]
}
```

### Batch Processing

```bash
curl -X POST "http://localhost:8000/api/v1/documents/batch" \
     -H "Content-Type: multipart/form-data" \
     -F "files=@doc1.pdf" \
     -F "files=@doc2.docx" \
     -F "files=@spreadsheet.xlsx"
```

### Knowledge Graph Exploration

```bash
# Get entity relationships
curl "http://localhost:8000/api/v1/knowledge/graph?entity=Maria%20Silva&depth=2"

# Find connections between entities
curl "http://localhost:8000/api/v1/knowledge/path?from=project_alpha&to=budget_2025"
```

### Semantic Search

```bash
curl -X POST "http://localhost:8000/api/v1/search/semantic" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "budget discussions and financial planning",
       "filters": {
         "date_range": ["2025-01-01", "2025-12-31"],
         "document_types": ["meeting_minutes", "financial_report"]
       },
       "limit": 10
     }'
```

## 📝 Main Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|-------------|
| `/api/v1/documents/process` | POST | Process single document | 30/min |
| `/api/v1/documents/batch` | POST | Batch document processing | 5/min |
| `/api/v1/documents/{id}` | GET | Get document analysis | 100/min |
| `/api/v1/documents/{id}/summary` | GET | Get document summary | 100/min |
| `/api/v1/documents/{id}/actions` | GET | Get action items | 100/min |
| `/api/v1/knowledge/graph` | GET | Knowledge graph queries | 20/min |
| `/api/v1/search/semantic` | POST | Semantic search | 60/min |
| `/api/v1/analytics/patterns` | GET | Temporal patterns | 10/min |
| `/api/v1/history` | GET | Processing history | 60/min |

## 🧪 Testing

### Run Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=app tests/ --cov-report=html

# Specific test suites
pytest tests/test_processing.py
pytest tests/test_knowledge_graph.py
pytest tests/test_summarization.py

# Performance tests
pytest tests/performance/ -v

# Integration tests
pytest tests/integration/ -v
```

### Test Coverage

- ✅ Document processing (PDF, DOCX, TXT, CSV, XLSX)
- ✅ Summarization (abstractive, extractive, hybrid)
- ✅ Action item extraction and assignee prediction
- ✅ Knowledge graph construction and queries
- ✅ Semantic search and vector indexing
- ✅ Temporal pattern detection
- ✅ Rate limiting and error handling
- ✅ End-to-end integration scenarios

## 📈 Performance

### Typical Benchmarks

- **Single document (< 10MB)**: < 3s processing time
- **Batch processing (10 documents)**: < 15s total
- **Semantic search**: < 200ms response time
- **Knowledge graph queries**: < 500ms
- **Cache hit ratio**: > 75% in typical usage

### Optimizations

- Rust-based core for I/O-intensive operations
- Intelligent chunking with adaptive sizing
- Vector indexing with HNSW for fast similarity search
- Redis caching for repeated operations
- Connection pooling for database operations
- Async processing for long-running tasks

## 🐳 Production Deployment

### Production Docker Compose

```bash
# Complete production deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale workers based on load
docker-compose -f docker-compose.prod.yml up -d --scale worker=4

# Health check
curl http://localhost:8000/health
```

### Production Configuration

- **Database**: PostgreSQL with pgvector extension
- **Cache**: Redis with persistence and clustering
- **Workers**: Multiple async workers with job queues
- **Monitoring**: Prometheus + Grafana dashboards
- **Security**: JWT authentication, input validation, rate limiting
- **Scaling**: Horizontal scaling with load balancing

## 📊 Monitoring

### Health Checks

```bash
# General health
curl http://localhost:8000/health

# Component-specific health
curl http://localhost:8000/api/v1/documents/health
curl http://localhost:8000/api/v1/knowledge/health
```

### Available Metrics

- Request volume and latency by endpoint
- Document processing success/failure rates
- ML model performance and inference times
- Cache hit/miss ratios
- Knowledge graph statistics
- Resource utilization (CPU, memory, disk)

### Structured Logging

```json
{
  "timestamp": "2025-08-18T10:30:00Z",
  "level": "INFO",
  "service": "schemaapi",
  "component": "document_processor",
  "message": "Document processed successfully",
  "context": {
    "document_id": "doc_123",
    "file_type": "pdf",
    "processing_time_ms": 2341,
    "action_items_found": 5,
    "entities_extracted": 23
  }
}
```

## 🔒 Security

- **Authentication**: JWT tokens with configurable expiration
- **Input Validation**: Strict validation for all file types and inputs
- **Rate Limiting**: Per-IP and per-endpoint rate limiting
- **Data Privacy**: Configurable PII redaction and anonymization
- **Audit Trail**: Complete logging of all document processing activities
- **Secure Containers**: Non-root containers with minimal attack surface

## 📚 Documentation

- **Interactive API Docs**: http://localhost:8000/docs
- **Alternative Documentation**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json
- **Knowledge Graph Visualization**: http://localhost:8000/graph

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Contact

**Thiago Di Faria**
- Email: thiagodifaria@gmail.com
- GitHub: [@thiagodifaria](https://github.com/thiagodifaria)
- Project: [https://github.com/thiagodifaria/SchemaAPI](https://github.com/thiagodifaria/SchemaAPI)

---

⭐ **SchemaAPI** - Transform documents into intelligence with precision and performance.