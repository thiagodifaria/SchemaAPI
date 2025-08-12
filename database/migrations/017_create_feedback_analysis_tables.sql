-- Migration: 017_create_feedback_analysis_tables
-- Date: 2025-08-12

-- Step 1: Create a table to store aggregated error patterns
CREATE TABLE error_patterns (
    id UUID PRIMARY KEY,
    prediction_type TEXT NOT NULL,
    error_type TEXT NOT NULL,
    occurrence_count INT NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMPTZ NOT NULL,
    example_feedback_ids UUID[],
    UNIQUE(prediction_type, error_type)
);

-- Step 2: Add a tracking column to the existing feedback table
ALTER TABLE feedback ADD COLUMN is_analyzed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_feedback_is_analyzed ON feedback(is_analyzed);