-- Migration: 013_create_temporal_patterns_table
-- Date: 2025-08-12

CREATE TABLE temporal_patterns (
    id UUID PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL,
    topic TEXT,
    period VARCHAR(50),
    trend_direction VARCHAR(50),
    confidence REAL,
    last_detected_at TIMESTAMPTZ NOT NULL,
    related_document_ids UUID[]
);

CREATE INDEX idx_temporal_patterns_pattern_type ON temporal_patterns(pattern_type);
CREATE INDEX idx_temporal_patterns_topic ON temporal_patterns(topic);