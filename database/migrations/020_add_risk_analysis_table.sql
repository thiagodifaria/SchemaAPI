CREATE TABLE financial_risk_analysis (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL UNIQUE REFERENCES processing_versions(id) ON DELETE CASCADE,
    risk_level VARCHAR(50) NOT NULL,
    confidence INT NOT NULL,
    summary TEXT,
    identified_clauses JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_risk_analysis_version_id ON financial_risk_analysis(processing_version_id);
CREATE INDEX idx_financial_risk_analysis_risk_level ON financial_risk_analysis(risk_level);