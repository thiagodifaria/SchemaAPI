use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use serde::Serialize;
use crate::domain::model::{
    document::{Document, ActionItem, DocumentQueryResult, ClassificationExample, ProcessingVersionWithDocument},
    knowledge_graph::{GraphResult, GraphNode, GraphEdge},
};

#[derive(Serialize, FromRow)]
pub struct ChunkSearchResult {
    pub document_id: Uuid,
    pub text_content: Option<String>,
    pub position: i32,
    pub distance: f32,
}

pub struct RawFile<'a> {
    pub file_name: &'a str,
    pub mime_type: &'a str,
    pub content: &'a [u8],
}

// Struct to group all results from a single version
#[derive(Default)]
pub struct VersionResults {
    pub action_items: Vec<ActionItem>,
    // In the future, we may add other results such as topics, etc.
}


pub struct PostgresRepository {
    pool: PgPool,
}

#[derive(FromRow)]
struct VersionInfo {
    id: Uuid,
}

#[derive(FromRow)]
struct DocumentId {
    id: Uuid,
}

impl PostgresRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn ingest_new_file(&self, doc: &Document, file: &RawFile<'_>, examples: &[ClassificationExample]) -> Result<(Uuid, Uuid), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            "INSERT INTO documents (id, source_hash, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (source_hash) DO NOTHING"
        )
        .bind(doc.id)
        .bind(&doc.source_hash)
        .bind(doc.created_at)
        .bind(doc.updated_at)
        .execute(&mut *tx)
        .await?;
        
        let doc_record = sqlx::query_as::<_, DocumentId>("SELECT id FROM documents WHERE source_hash = $1")
            .bind(&doc.source_hash)
            .fetch_one(&mut *tx)
            .await?;
        let document_id = doc_record.id;

        let version_number: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(version_number), 0) + 1 FROM processing_versions WHERE document_id = $1")
            .bind(document_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(1);

        let version_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO processing_versions (id, document_id, version_number, status, created_at) VALUES ($1, $2, $3, $4, NOW())"
        )
        .bind(version_id)
        .bind(document_id)
        .bind(version_number)
        .bind("Processing")
        .execute(&mut *tx)
        .await?;
        
        sqlx::query(
            "INSERT INTO raw_files (id, processing_version_id, file_name, mime_type, content) VALUES (gen_random_uuid(), $1, $2, $3, $4)"
        )
        .bind(version_id)
        .bind(file.file_name)
        .bind(file.mime_type)
        .bind(file.content)
        .execute(&mut *tx)
        .await?;

        for example in examples {
            sqlx::query(
                "INSERT INTO classification_examples (id, processing_version_id, example_text, example_label) VALUES (gen_random_uuid(), $1, $2, $3)"
            )
            .bind(version_id)
            .bind(&example.example_text)
            .bind(&example.example_label)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok((document_id, version_id))
    }

    async fn get_latest_version_id(&self, doc_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
        let result = sqlx::query_as::<_, VersionInfo>(
            "SELECT id FROM processing_versions WHERE document_id = $1 ORDER BY version_number DESC LIMIT 1"
        )
        .bind(doc_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|r| r.id))
    }

    pub async fn find_document_by_id(&self, doc_id: Uuid) -> Result<Option<DocumentQueryResult>, sqlx::Error> {
        if let Some(version_id) = self.get_latest_version_id(doc_id).await? {
            let document_result = sqlx::query_as::<_, ProcessingVersionWithDocument>(
                r#"
                SELECT d.id, d.source_hash, pv.status, pv.summary_text, pv.summary_type, pv.summary_confidence, pv.created_at, d.updated_at
                FROM documents d JOIN processing_versions pv ON d.id = pv.document_id
                WHERE pv.id = $1
                "#
            )
            .bind(version_id)
            .fetch_optional(&self.pool)
            .await?;
            
            if let Some(document) = document_result {
                let action_items = sqlx::query_as::<_, ActionItem>("SELECT * FROM action_items WHERE processing_version_id = $1 ORDER BY created_at ASC")
                    .bind(version_id)
                    .fetch_all(&self.pool)
                    .await?;
                return Ok(Some(DocumentQueryResult { document, action_items }));
            }
        }
        Ok(None)
    }

    pub async fn search_chunks_semantic(&self, query_vector: &[f32]) -> Result<Vec<ChunkSearchResult>, sqlx::Error> {
        let query_embedding_sql = pgvector::Vector::from(query_vector.to_vec());
        
        let results = sqlx::query_as::<_, ChunkSearchResult>(
            r#"
            SELECT pv.document_id, c.text_content, c.position, (c.embedding <=> $1) as distance 
            FROM chunks c
            JOIN processing_versions pv ON c.processing_version_id = pv.id
            WHERE c.embedding IS NOT NULL 
            ORDER BY distance ASC 
            LIMIT 10
            "#
        )
        .bind(query_embedding_sql)
        .fetch_all(&self.pool)
        .await?;

        Ok(results)
    }

    pub async fn find_graph_by_document_id(&self, doc_id: Uuid) -> Result<GraphResult, sqlx::Error> {
        if let Some(version_id) = self.get_latest_version_id(doc_id).await? {
            let nodes = sqlx::query_as::<_, GraphNode>(
                r#"
                SELECT DISTINCT e.id, e.name as label, e.entity_type as node_type
                FROM entities e
                JOIN entity_mentions em ON e.id = em.entity_id
                WHERE em.processing_version_id = $1
                "#
            )
            .bind(version_id)
            .fetch_all(&self.pool)
            .await?;

            let edges = sqlx::query_as::<_, GraphEdge>(
                r#"
                SELECT source_entity_id as source, target_entity_id as target, relationship_type as label
                FROM relationships
                WHERE processing_version_id = $1
                "#
            )
            .bind(version_id)
            .fetch_all(&self.pool)
            .await?;

            return Ok(GraphResult { nodes, edges });
        }
        Ok(GraphResult { nodes: vec![], edges: vec![] })
    }

    pub async fn find_results_by_version_number(&self, doc_id: Uuid, version_number: i32) -> Result<Option<VersionResults>, sqlx::Error> {
        let version_result = sqlx::query_as::<_, VersionInfo>(
            "SELECT id FROM processing_versions WHERE document_id = $1 AND version_number = $2"
        )
        .bind(doc_id)
        .bind(version_number)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(version) = version_result {
            let action_items = sqlx::query_as::<_, ActionItem>(
                "SELECT * FROM action_items WHERE processing_version_id = $1"
            )
            .bind(version.id)
            .fetch_all(&self.pool)
            .await?;
            
            // In the future, look for other results (topics, etc.) here
            
            Ok(Some(VersionResults { action_items }))
        } else {
            Ok(None)
        }
    }
}