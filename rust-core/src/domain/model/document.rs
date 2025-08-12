use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDate};
use sqlx::FromRow;

#[derive(Serialize, Deserialize, FromRow, Debug)]
pub struct Document {
    pub id: Uuid,
    pub source_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Debug)]
pub struct Chunk {
    pub id: Uuid,
    pub processing_version_id: Uuid,
    pub text_content: Option<String>,
    pub speaker: Option<String>,
    pub position: i32,
    pub token_count: i32,
    pub created_at: DateTime<Utc>,
    // O tipo pgvector::Vector não implementa Clone/Hash/etc. por padrão
    // por isso não podemos derivá-los aqui se o campo estiver ativo.
    // pub embedding: Option<pgvector::Vector>,
}

#[derive(Serialize, Deserialize, FromRow, Clone, PartialEq, Eq, Hash, Debug)]
pub struct ActionItem {
    pub id: Uuid,
    pub processing_version_id: Uuid,
    pub task_text: String,
    pub original_text: Option<String>,
    pub assignee_name: Option<String>,
    pub due_date: Option<NaiveDate>,
    pub priority: Option<String>,
    pub confidence: Option<f32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, FromRow, Debug)]
pub struct ProcessingVersionWithDocument {
    pub id: Uuid,
    pub source_hash: String,
    pub status: String,
    pub summary_text: Option<String>,
    pub summary_type: Option<String>,
    pub summary_confidence: Option<f32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}


#[derive(Serialize, Debug)]
pub struct DocumentQueryResult {
    #[serde(flatten)]
    pub document: ProcessingVersionWithDocument,
    pub action_items: Vec<ActionItem>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClassificationExample {
    pub example_text: String,
    pub example_label: String,
}