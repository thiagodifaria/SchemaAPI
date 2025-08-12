-- Migration: 016_create_financial_kpis_table
-- Date: 2025-08-12

CREATE TABLE financial_kpis (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL REFERENCES processing_versions(id) ON DELETE CASCADE,
    kpi_name TEXT NOT NULL,
    kpi_value NUMERIC(18, 2) NOT NULL,
    kpi_currency VARCHAR(10),
    period VARCHAR(100),
    source_snippet TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_kpis_version_id ON financial_kpis(processing_version_id);
CREATE INDEX idx_financial_kpis_kpi_name ON financial_kpis(kpi_name);