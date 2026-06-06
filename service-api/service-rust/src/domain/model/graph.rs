use serde::Serialize;
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Serialize, FromRow, Clone)]
pub struct GraphNode {
    pub id: Uuid,
    pub label: String,
    pub node_type: String,
}

#[derive(Serialize, FromRow, Clone)]
pub struct GraphEdge {
    pub source: Uuid,
    pub target: Uuid,
    pub label: String,
}

#[derive(Serialize, Clone)]
pub struct GraphCommunity {
    pub label: String,
    pub node_count: usize,
    pub summary: String,
}

#[derive(Serialize)]
pub struct GraphResult {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub communities: Vec<GraphCommunity>,
}
