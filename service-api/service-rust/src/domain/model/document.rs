use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDate};
use sqlx::FromRow;
use std::hash::{Hash, Hasher};

#[derive(Serialize, Deserialize, FromRow, Debug)]
pub struct Document {
    pub id: Uuid,
    pub source_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Debug, Clone)]
pub struct Chunk {
    pub id: Uuid,
    pub processing_version_id: Uuid,
    pub text_content: Option<String>,
    pub speaker: Option<String>,
    pub position: i32,
    pub token_count: i32,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing, skip_deserializing)]
    pub embedding: Option<pgvector::Vector>,
}

impl PartialEq for Chunk {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id && self.text_content == other.text_content
    }
}
impl Eq for Chunk {}

impl Hash for Chunk {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.id.hash(state);
        self.text_content.hash(state);
    }
}


#[derive(Serialize, Deserialize, FromRow, Clone, Debug)]
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
    pub dependencies: Option<Vec<Uuid>>,
}

impl PartialEq for ActionItem {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
            && self.task_text == other.task_text
            && self.original_text == other.original_text
            && self.assignee_name == other.assignee_name
            && self.due_date == other.due_date
            && self.priority == other.priority
            && self.dependencies == other.dependencies
    }
}

impl Eq for ActionItem {}

impl Hash for ActionItem {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.id.hash(state);
        self.task_text.hash(state);
        self.original_text.hash(state);
        self.assignee_name.hash(state);
        self.due_date.hash(state);
        self.priority.hash(state);
        self.dependencies.hash(state);
    }
}

#[derive(Serialize, FromRow, Debug)]
pub struct ProcessingVersionWithDocument {
    pub id: Uuid,
    pub processing_version_id: Uuid,
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
