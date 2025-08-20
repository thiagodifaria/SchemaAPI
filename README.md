# SchemaAPI

![SchemaAPI Logo](https://img.shields.io/badge/SchemaAPI-Document%20Intelligence-blue?style=for-the-badge&logo=document)

**Advanced Multilingual Document Processing and Intelligence API**

[![Python](https://img.shields.io/badge/Python-3.10+-3776ab?style=flat&logo=python&logoColor=white)](https://python.org)
[![Rust](https://img.shields.io/badge/Rust-Latest-000000?style=flat&logo=rust&logoColor=white)](https://rust-lang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Transformers](https://img.shields.io/badge/🤗_Transformers-Latest-yellow?style=flat)](https://huggingface.co/transformers)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?style=flat&logo=docker&logoColor=white)](https://docker.com)

---

## 🌍 **Documentation / Documentação**

**📖 [🇺🇸 Read in English](README_EN.md)**  
**📖 [🇧🇷 Leia em Português](README_PT.md)**

---

## 🎯 What is SchemaAPI?

SchemaAPI is a **production-ready intelligent document processing API** that transforms unstructured content into actionable insights. Built with **Rust** for high-performance core processing and **Python** for flexible ML capabilities, it handles texts, transcriptions, PDFs, DOCX, and spreadsheets with advanced NLP techniques.

### ⚡ Key Highlights

- 🌍 **Multilingual Native Support** - Portuguese, English, Spanish with unified processing
- 🚀 **Hybrid Architecture** - Rust core for performance, Python for ML flexibility
- 📊 **Complete Intelligence Pipeline** - Summaries, topics, action items, classifications
- 🔄 **Batch & Async Processing** - Handle single documents or massive batches efficiently
- 🕸️ **Knowledge Graph Construction** - Discover relationships and build organizational knowledge
- 📈 **Temporal Pattern Detection** - Identify trends, anomalies, and recurring patterns
- 🛡️ **Production Ready** - Rate limiting, health checks, audit trails, versioning
- 🐳 **Easy Deployment** - Docker Compose setup with Redis, PostgreSQL, and workers

### 🏆 What Makes It Special?

```
✅ Hybrid Rust/Python architecture for optimal performance
✅ Advanced NLP with extractive/abstractive summarization
✅ Intelligent action item extraction with assignee prediction
✅ Knowledge graph construction and relationship discovery
✅ Temporal pattern detection and forecasting
✅ Multi-format support with intelligent normalization
✅ Continuous learning through feedback loops
✅ Vertical specialization for finance, legal, HR domains
```

---

## ⚡ Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Clone and run with all services
git clone https://github.com/thiagodifaria/SchemaAPI.git
cd SchemaAPI
docker-compose up --build

# API available at: http://localhost:8000
# Docs available at: http://localhost:8000/docs
```

### Option 2: Local Development
```bash
git clone https://github.com/thiagodifaria/SchemaAPI.git
cd SchemaAPI
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 🔥 Test It Now!
```bash
# Process document
curl -X POST "http://localhost:8000/api/v1/documents/process" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@meeting-notes.pdf"

# Response:
# {
#   "document_id": "c5d3b066-013b-4a9c-baeb-5f420200f796",
#   "processing_status": "completed",
#   "summary": "Product roadmap discussion with Q3 priorities...",
#   "action_items": [
#     {
#       "task": "Finalize budget proposal",
#       "assignee": "Maria Silva",
#       "due_date": "2025-08-25",
#       "priority": "high"
#     }
#   ],
#   "topics": ["budget", "roadmap", "priorities"],
#   "processing_time_ms": 2341.7
# }
```

---

## 🔍 API Overview

| Feature | Endpoint | Description |
|---------|----------|-------------|
| 📄 **Document Processing** | `POST /api/v1/documents/process` | Process single document |
| 📦 **Batch Processing** | `POST /api/v1/documents/batch` | Process multiple documents |
| 📊 **Document Analysis** | `GET /api/v1/documents/{id}/analysis` | Get complete analysis |
| 🕸️ **Knowledge Graph** | `GET /api/v1/knowledge/graph` | Explore relationships |
| 📈 **Pattern Analytics** | `GET /api/v1/analytics/patterns` | Temporal patterns and trends |
| 🔍 **Semantic Search** | `POST /api/v1/search/semantic` | Search by meaning |
| 📋 **History** | `GET /api/v1/history` | Query processing history |
| 🏥 **Health Check** | `GET /health` | Service health monitoring |

---

## 📞 Contact

**Thiago Di Faria** - thiagodifaria@gmail.com

[![GitHub](https://img.shields.io/badge/GitHub-@thiagodifaria-black?style=flat&logo=github)](https://github.com/thiagodifaria)

---

**Made by [Thiago Di Faria](https://github.com/thiagodifaria)**