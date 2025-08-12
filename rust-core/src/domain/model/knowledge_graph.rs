use serde::Serialize;
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Serialize, FromRow)]
pub struct GraphNode {
    pub id: Uuid,
    pub label: String,
    pub node_type: String,
}

#[derive(Serialize, FromRow)]
pub struct GraphEdge {
    pub source: Uuid,
    pub target: Uuid,
    pub label: String,
}

#[derive(Serialize)]
pub struct GraphResult {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}