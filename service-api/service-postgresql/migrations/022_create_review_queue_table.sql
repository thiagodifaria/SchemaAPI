CREATE TABLE review_queue (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL REFERENCES processing_versions(id) ON DELETE CASCADE,
    prediction_id UUID NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    priority REAL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_review_queue_priority ON review_queue(priority DESC);