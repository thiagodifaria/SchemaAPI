-- Migration: 005_enable_pgvector_and_add_embedding_column
-- Date: 2025-08-12

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE chunks ADD COLUMN embedding vector(384);

CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);