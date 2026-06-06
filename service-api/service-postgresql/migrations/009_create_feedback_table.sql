CREATE TABLE feedback (
    id UUID PRIMARY KEY,
    prediction_id UUID NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,
    feedback_type VARCHAR(50) NOT NULL,
    original_data JSONB,
    corrected_data JSONB NOT NULL,
    user_context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_prediction_id ON feedback(prediction_id);