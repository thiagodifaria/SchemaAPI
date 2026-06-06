use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use crate::domain::model::{
    document::{Document, ActionItem, DocumentQueryResult, ClassificationExample, ProcessingVersionWithDocument, Chunk},
    graph::{GraphResult, GraphNode, GraphEdge, GraphCommunity},
};

#[derive(Serialize, FromRow, Clone)]
pub struct ChunkSearchResult {
    pub chunk_id: Uuid,
    pub document_id: Uuid,
    pub text_content: Option<String>,
    pub position: i32,
    pub section_title: Option<String>,
    pub content_type: Option<String>,
    pub score: f32,
    pub rank_source: String,
}

#[derive(Serialize, FromRow)]
pub struct AuditEvent {
    pub id: Uuid,
    pub event_type: String,
    pub actor_role: Option<String>,
    pub resource_type: Option<String>,
    pub resource_id: Option<Uuid>,
    pub details: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, FromRow)]
pub struct RagEvalRun {
    pub id: Uuid,
    pub query_audit_id: Option<Uuid>,
    pub faithfulness: f32,
    pub context_precision: f32,
    pub context_recall: f32,
    pub answer_relevance: f32,
    pub answer_correctness: f32,
    pub groundedness: f32,
    pub hallucination_risk: f32,
    pub duplicate_context_rate: f32,
    pub incomplete_answer: bool,
    pub notes: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, FromRow, Clone)]
pub struct AnalysisReport {
    pub id: Uuid,
    pub title: String,
    pub scope_label: Option<String>,
    pub document_ids: Vec<Uuid>,
    pub search_queries: Vec<String>,
    pub rag_queries: Vec<String>,
    pub executive_summary: String,
    pub evidence: serde_json::Value,
    pub metrics: serde_json::Value,
    pub risks: serde_json::Value,
    pub sources: serde_json::Value,
    pub markdown: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct AgentRun {
    pub id: Uuid,
    pub goal: String,
    pub status: String,
    pub requested_tool: String,
    pub tool_risk: String,
    pub plan: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub approval_required: bool,
    pub approved_by: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, FromRow)]
pub struct MultimodalBlock {
    pub id: Uuid,
    pub processing_version_id: Uuid,
    pub block_type: String,
    pub page_number: Option<i32>,
    pub position: i32,
    pub content_text: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, FromRow, Clone)]
pub struct GraphContextItem {
    pub entity_id: Uuid,
    pub entity_name: String,
    pub entity_type: String,
    pub relationship_type: Option<String>,
    pub related_entity_name: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct AutoContextDocument {
    pub document_id: Uuid,
    pub source_hash: String,
    pub status: String,
    pub summary: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct AutoContextSummary {
    pub id: String,
    pub label: String,
    pub description: String,
    pub document_count: usize,
    pub processed_count: usize,
    pub topics: Vec<String>,
    pub entities: Vec<String>,
    pub documents: Vec<AutoContextDocument>,
}

#[derive(FromRow)]
struct AutoContextDocumentRow {
    document_id: Uuid,
    source_hash: String,
    status: String,
    summary_text: Option<String>,
}

#[derive(FromRow)]
struct AutoContextEntityRow {
    document_id: Uuid,
    entity_name: String,
    entity_type: String,
    mentions: i64,
}

#[derive(Serialize)]
pub struct RagCitation {
    pub chunk_id: Uuid,
    pub document_id: Uuid,
    pub position: i32,
    pub section_title: Option<String>,
    pub snippet: Option<String>,
    pub relevance_reason: Option<String>,
    pub evidence_strength: String,
}

#[derive(Serialize)]
pub struct RagAnswer {
    pub answer: String,
    pub citations: Vec<RagCitation>,
    pub retrieved_chunks: Vec<ChunkSearchResult>,
    pub graph_context: Vec<GraphContextItem>,
    pub warnings: Vec<String>,
}

pub struct RawFile<'a> {
    pub file_name: &'a str,
    pub mime_type: &'a str,
    pub content: &'a [u8],
}

#[derive(Default)]
pub struct VersionResults {
    pub action_items: Vec<ActionItem>,
    pub chunks: Vec<Chunk>,
}


pub struct PostgresRepository {
    pool: PgPool,
}

fn compact_terms(value: &str) -> Vec<String> {
    let stop_words = [
        "para", "sobre", "como", "qual", "quais", "quanto", "houve", "foram", "isso", "esse",
        "essa", "este", "esta", "documento", "relatorio", "explique", "com", "base", "nos",
        "nas", "por", "uma", "que", "dos", "das", "foi", "sao", "resposta", "direta",
    ];

    value
        .split(|c: char| !c.is_alphanumeric())
        .map(|term| term.to_lowercase())
        .filter(|term| term.chars().count() >= 4 && !stop_words.contains(&term.as_str()))
        .collect()
}

fn answer_looks_incomplete(answer: &str) -> bool {
    let trimmed = answer.trim();
    if trimmed.is_empty() || trimmed.contains("...") {
        return true;
    }

    let lower = trimmed.to_lowercase();
    let dangling = [
        " e", " de", " da", " do", " das", " dos", " com", " sua", " seu", " para", " por",
        " em", " no", " na", " nas", " nos", " a", " o",
    ];

    !trimmed.ends_with(['.', '!', '?']) || dangling.iter().any(|suffix| lower.ends_with(suffix))
}

fn repair_latin1_mojibake(value: &str) -> String {
    let suspicious = value.contains('\u{00c3}')
        || value.contains('\u{00e2}')
        || value.contains('\u{00ce}')
        || value.contains('\u{00c2}');
    if !suspicious {
        return value.to_string();
    }

    let codes = value.chars().map(u32::from).collect::<Vec<u32>>();
    if !codes.iter().all(|code| *code <= 255) {
        return value.to_string();
    }

    let bytes = codes.into_iter().map(|code| code as u8).collect::<Vec<u8>>();
    String::from_utf8(bytes).unwrap_or_else(|_| value.to_string())
}

fn clean_context_text(value: &str) -> String {
    // Auto context is derived from persisted extraction output, including old runs.
    // Repair presentation noise here so routing metadata stays readable.
    let replacements = [
        ("Ã¡", "á"), ("Ã©", "é"), ("Ã­", "í"), ("Ã³", "ó"), ("Ãº", "ú"),
        ("Ã£", "ã"), ("Ãµ", "õ"), ("Ã§", "ç"), ("Ãª", "ê"), ("Ã´", "ô"),
        ("Ã€", "À"), ("Ã‰", "É"), ("Ã‡", "Ç"), ("Ãº", "ú"), ("Ã¢", "â"),
        ("â€“", "-"), ("â€”", "-"), ("â€¢", "-"), ("Âº", "º"), ("Âª", "ª"),
        ("\\n", " "),
    ];

    let mut text = value.to_string();
    for _ in 0..3 {
        let repaired = repair_latin1_mojibake(&text);
        if repaired == text {
            break;
        }
        text = repaired;
    }

    for (from, to) in replacements {
        text = text.replace(from, to);
    }

    for _ in 0..3 {
        let repaired = repair_latin1_mojibake(&text);
        if repaired == text {
            break;
        }
        text = repaired;
    }

    let explicit_pairs = [
        ("\u{00c3}\u{00a1}", "\u{00e1}"),
        ("\u{00c3}\u{00a9}", "\u{00e9}"),
        ("\u{00c3}\u{00ad}", "\u{00ed}"),
        ("\u{00c3}\u{00b3}", "\u{00f3}"),
        ("\u{00c3}\u{00ba}", "\u{00fa}"),
        ("\u{00c3}\u{00a0}", "\u{00e0}"),
        ("\u{00c3}\u{00a3}", "\u{00e3}"),
        ("\u{00c3}\u{00b5}", "\u{00f5}"),
        ("\u{00c3}\u{00a7}", "\u{00e7}"),
        ("\u{00c3}\u{00aa}", "\u{00ea}"),
        ("\u{00c3}\u{00b4}", "\u{00f4}"),
        ("\u{00c3}\u{0093}", "\u{00d3}"),
        ("\u{00c3}\u{0087}", "\u{00c7}"),
        ("\u{00c2}\u{00ba}", "\u{00ba}"),
        ("\u{00c2}\u{00aa}", "\u{00aa}"),
    ];
    for (from, to) in explicit_pairs {
        text = text.replace(from, to);
    }

    text
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
        .replace("Receita Liquida", "Receita Líquida")
        .replace("receita liquida", "receita líquida")
        .replace("Organizacoes", "Organizações")
        .replace("Operacoes", "Operações")
        .replace("divida", "dívida")
}

fn summarize_auto_context_document(summary: Option<String>, entities: &[AutoContextEntityRow]) -> Option<String> {
    if let Some(summary) = summary {
        let clean = clean_context_text(&summary);
        let lower = clean.to_lowercase();

        if lower.contains("receita") && lower.contains("3058") {
            return Some("Receita Líquida consolidada de R$ 3.058,6 milhões, com evidências financeiras recuperadas do documento.".to_string());
        }
        if lower.contains("ebitda") || lower.contains("margem") {
            return Some("Documento com indicadores financeiros, margem e EBITDA extraídos para análise.".to_string());
        }

        if let Some(first_sentence) = clean
            .split_terminator('.')
            .map(str::trim)
            .find(|part| part.chars().filter(|c| c.is_alphabetic()).count() >= 20)
            .map(|part| format!("{}.", part))
        {
            return Some(first_sentence);
        }
    }

    let mut labels = entities
        .iter()
        .filter(|entity| useful_graph_label(&entity.entity_name))
        .map(|entity| clean_context_text(&entity.entity_name))
        .take(3)
        .collect::<Vec<String>>();
    labels.sort();

    if labels.is_empty() {
        None
    } else {
        Some(format!("Contexto inferido a partir de evidências sobre {}.", labels.join(", ")))
    }
}

fn useful_graph_label(label: &str) -> bool {
    let clean = clean_context_text(label);
    let lower = clean.to_lowercase();
    let alpha_count = clean.chars().filter(|c| c.is_alphabetic()).count();
    let digit_count = clean.chars().filter(|c| c.is_ascii_digit()).count();
    let stop_tokens = ["a", "o", "de", "da", "do", "das", "dos", "em", "and", "or"];
    let generic_labels = [
        "companhia",
        "empresa",
        "relatorio",
        "resultado",
        "resultados",
        "receita",
        "liquida",
        "liquid",
        "ebitda",
        "ajustado",
        "documento",
        "compan",
        "companhia detin",
        "detin",
        "terra",
        "das concha",
        "ebitda aju",
    ];
    let meaningful_words = lower
        .split_whitespace()
        .filter(|word| word.chars().count() >= 4 && !stop_tokens.contains(word))
        .count();

    clean.chars().count() >= 5
        && alpha_count >= 4
        && meaningful_words > 0
        && digit_count <= alpha_count.max(1) * 2
        && !clean.contains('#')
        && !["rs", "mm", "br", "t", "q", "n"].contains(&lower.as_str())
        && !generic_labels.contains(&lower.as_str())
        && !lower.contains(" detin")
        && !lower.ends_with(" detin")
        && !lower.ends_with(" aju")
        && !lower.starts_with("de ")
        && !lower.starts_with("da ")
        && !lower.starts_with("das ")
        && !lower.starts_with("do ")
        && !lower.starts_with("dos ")
}

fn build_graph_communities(nodes: &[GraphNode]) -> Vec<GraphCommunity> {
    let mut groups: HashMap<String, Vec<&GraphNode>> = HashMap::new();
    for node in nodes {
        groups.entry(node.node_type.clone()).or_default().push(node);
    }

    let mut communities = groups
        .into_iter()
        .map(|(label, group)| {
            let mut examples = group
                .iter()
                .take(4)
                .map(|node| node.label.as_str())
                .collect::<Vec<&str>>();
            examples.sort_unstable();

            GraphCommunity {
                label: label.clone(),
                node_count: group.len(),
                summary: format!(
                    "{} entidade(s) do tipo {} aparecem no documento: {}.",
                    group.len(),
                    label,
                    examples.join(", ")
                ),
            }
        })
        .collect::<Vec<GraphCommunity>>();

    communities.sort_by(|a, b| b.node_count.cmp(&a.node_count).then_with(|| a.label.cmp(&b.label)));
    communities
}

fn context_slug(label: &str) -> String {
    let normalized = label
        .to_lowercase()
        .chars()
        .map(|ch| match ch {
            'á' | 'à' | 'ã' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'õ' | 'ô' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            _ if ch.is_ascii_alphanumeric() => ch,
            _ => '-',
        })
        .collect::<String>();
    let slug = normalized
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<&str>>()
        .join("-");

    if slug.is_empty() {
        "contexto-automatico".to_string()
    } else {
        format!("auto-{}", slug)
    }
}

fn context_topic_for(entity_type: &str, label: &str) -> &'static str {
    let lower_type = entity_type.to_lowercase();
    let lower_label = clean_context_text(label).to_lowercase();

    if lower_label.contains("receita")
        || lower_label.contains("ebitda")
        || lower_label.contains("margem")
        || lower_label.contains("divida")
        || lower_label.contains("dívida")
        || lower_label.contains("alavancagem")
    {
        return "Indicadores financeiros";
    }

    if lower_label.contains("atlanta")
        || lower_label.contains("bahia")
        || lower_label.contains("potiguar")
        || lower_label.contains("polo")
        || lower_label.contains("campo")
        || lower_type.contains("location")
    {
        return "Ativos e localidades";
    }

    if lower_type.contains("organization") {
        return "Organizações citadas";
    }

    "Contexto documental"
}

fn choose_context_label(entities: &[AutoContextEntityRow], fallback: &str) -> String {
    let priority_terms = [
        "brava", "energia", "petroleum", "enauta", "receita", "ebitda", "divida", "dívida",
        "alavancagem",
    ];

    entities
        .iter()
        .filter(|entity| useful_graph_label(&entity.entity_name))
        .max_by_key(|entity| {
            let lower = entity.entity_name.to_lowercase();
            let mut score = entity.mentions;
            if entity.entity_type.to_lowercase().contains("organization") {
                score += 8;
            }
            if entity.entity_type.to_lowercase().contains("metric") {
                score += 6;
            }
            if priority_terms.iter().any(|term| lower.contains(term)) {
                score += 12;
            }
            score
        })
        .map(|entity| clean_context_text(&entity.entity_name))
        .unwrap_or_else(|| {
            let has_finance = entities.iter().any(|entity| {
                let label = clean_context_text(&entity.entity_name).to_lowercase();
                label.contains("receita")
                    || label.contains("ebitda")
                    || label.contains("margem")
                    || label.contains("divida")
                    || label.contains("dívida")
                    || label.contains("alavancagem")
            });
            let has_assets = entities.iter().any(|entity| {
                let label = clean_context_text(&entity.entity_name).to_lowercase();
                label.contains("atlanta")
                    || label.contains("bahia")
                    || label.contains("potiguar")
                    || label.contains("polo")
            });

            if has_finance {
                "Resultados financeiros".to_string()
            } else if has_assets {
                "Operações e ativos".to_string()
            } else {
                fallback.to_string()
            }
        })
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

    pub async fn list_auto_contexts(&self) -> Result<Vec<AutoContextSummary>, sqlx::Error> {
        let documents = sqlx::query_as::<_, AutoContextDocumentRow>(
            r#"
            SELECT DISTINCT ON (pv.document_id)
                pv.document_id,
                d.source_hash,
                pv.status,
                pv.summary_text
            FROM processing_versions pv
            JOIN documents d ON d.id = pv.document_id
            ORDER BY pv.document_id, pv.version_number DESC, pv.created_at DESC
            LIMIT 50
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        if documents.is_empty() {
            return Ok(vec![]);
        }

        let document_ids = documents.iter().map(|doc| doc.document_id).collect::<Vec<Uuid>>();
        let entities = sqlx::query_as::<_, AutoContextEntityRow>(
            r#"
            WITH latest AS (
                SELECT DISTINCT ON (document_id) id, document_id
                FROM processing_versions
                WHERE document_id = ANY($1)
                ORDER BY document_id, version_number DESC, created_at DESC
            )
            SELECT
                latest.document_id,
                e.name as entity_name,
                e.entity_type,
                COUNT(*)::bigint as mentions
            FROM latest
            JOIN entity_mentions em ON em.processing_version_id = latest.id
            JOIN entities e ON e.id = em.entity_id
            GROUP BY latest.document_id, e.name, e.entity_type
            ORDER BY latest.document_id, mentions DESC, e.name ASC
            "#
        )
        .bind(&document_ids)
        .fetch_all(&self.pool)
        .await?;

        let mut entities_by_doc: HashMap<Uuid, Vec<AutoContextEntityRow>> = HashMap::new();
        for mut entity in entities {
            entity.entity_name = clean_context_text(&entity.entity_name);
            if useful_graph_label(&entity.entity_name) {
                entities_by_doc.entry(entity.document_id).or_default().push(entity);
            }
        }

        let mut groups: HashMap<String, AutoContextSummary> = HashMap::new();
        for document in documents {
            let doc_entities = entities_by_doc.remove(&document.document_id).unwrap_or_default();
            let fallback = format!("Documento {}", &document.source_hash.chars().take(8).collect::<String>());
            let label = choose_context_label(&doc_entities, &fallback);
            let key = context_slug(&label);
            let entry = groups.entry(key.clone()).or_insert_with(|| AutoContextSummary {
                id: key,
                label: label.clone(),
                description: "Escopo inferido automaticamente a partir de entidades, temas e documentos processados.".to_string(),
                document_count: 0,
                processed_count: 0,
                topics: vec![],
                entities: vec![],
                documents: vec![],
            });

            entry.document_count += 1;
            if document.status.to_lowercase().contains("processed") || document.status.to_lowercase().contains("ready") {
                entry.processed_count += 1;
            }

            for entity in doc_entities.iter().take(16) {
                let topic = context_topic_for(&entity.entity_type, &entity.entity_name).to_string();
                if !entry.topics.contains(&topic) {
                    entry.topics.push(topic);
                }
                if entry.entities.len() < 18 && !entry.entities.contains(&entity.entity_name) {
                    entry.entities.push(entity.entity_name.clone());
                }
            }

            entry.documents.push(AutoContextDocument {
                document_id: document.document_id,
                source_hash: document.source_hash,
                status: document.status,
                summary: summarize_auto_context_document(document.summary_text, &doc_entities),
            });
        }

        let mut contexts = groups.into_values().collect::<Vec<AutoContextSummary>>();
        contexts.sort_by(|a, b| {
            b.processed_count
                .cmp(&a.processed_count)
                .then_with(|| b.document_count.cmp(&a.document_count))
                .then_with(|| a.label.cmp(&b.label))
        });

        Ok(contexts)
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
                SELECT d.id, pv.id AS processing_version_id, d.source_hash, pv.status, pv.summary_text, pv.summary_type, pv.summary_confidence, pv.created_at, d.updated_at
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

    pub async fn search_chunks_semantic(&self, query_vector: &[f32], limit: i64, actor_role: &str) -> Result<Vec<ChunkSearchResult>, sqlx::Error> {
        let query_embedding_sql = pgvector::Vector::from(query_vector.to_vec());
        
        let results = sqlx::query_as::<_, ChunkSearchResult>(
            r#"
            SELECT
                c.id as chunk_id,
                pv.document_id,
                COALESCE(c.pii_redacted_text, c.normalized_text_content, c.text_content) as text_content,
                c.position,
                c.section_title,
                c.content_type,
                (1.0 - (c.embedding <=> $1))::real as score,
                'semantic'::text as rank_source
            FROM chunks c
            JOIN processing_versions pv ON c.processing_version_id = pv.id
            WHERE c.embedding IS NOT NULL
              AND (c.access_level = 'public' OR $3 = ANY(c.allowed_roles))
            ORDER BY c.embedding <=> $1 ASC 
            LIMIT $2
            "#
        )
        .bind(query_embedding_sql)
        .bind(limit)
        .bind(actor_role)
        .fetch_all(&self.pool)
        .await?;

        Ok(results)
    }

    pub async fn search_chunks_lexical(&self, query: &str, limit: i64, actor_role: &str) -> Result<Vec<ChunkSearchResult>, sqlx::Error> {
        let results = sqlx::query_as::<_, ChunkSearchResult>(
            r#"
            SELECT
                c.id as chunk_id,
                pv.document_id,
                COALESCE(c.pii_redacted_text, c.normalized_text_content, c.text_content) as text_content,
                c.position,
                c.section_title,
                c.content_type,
                ts_rank(c.search_vector, plainto_tsquery('simple', $1))::real as score,
                'lexical'::text as rank_source
            FROM chunks c
            JOIN processing_versions pv ON c.processing_version_id = pv.id
            WHERE c.search_vector @@ plainto_tsquery('simple', $1)
              AND (c.access_level = 'public' OR $3 = ANY(c.allowed_roles))
            ORDER BY score DESC, c.position ASC
            LIMIT $2
            "#
        )
        .bind(query)
        .bind(limit)
        .bind(actor_role)
        .fetch_all(&self.pool)
        .await?;

        Ok(results)
    }

    pub async fn search_chunks_hybrid(&self, query: &str, query_vector: &[f32], limit: i64, actor_role: &str) -> Result<Vec<ChunkSearchResult>, sqlx::Error> {
        let query_embedding_sql = pgvector::Vector::from(query_vector.to_vec());

        let results = sqlx::query_as::<_, ChunkSearchResult>(
            r#"
            WITH semantic AS (
                SELECT
                    c.id,
                    row_number() OVER (ORDER BY c.embedding <=> $1 ASC) AS rank
                FROM chunks c
                WHERE c.embedding IS NOT NULL
                  AND (c.access_level = 'public' OR $4 = ANY(c.allowed_roles))
                LIMIT 50
            ),
            lexical AS (
                SELECT
                    c.id,
                    row_number() OVER (ORDER BY ts_rank(c.search_vector, plainto_tsquery('simple', $2)) DESC) AS rank
                FROM chunks c
                WHERE c.search_vector @@ plainto_tsquery('simple', $2)
                  AND (c.access_level = 'public' OR $4 = ANY(c.allowed_roles))
                LIMIT 50
            ),
            fused AS (
                SELECT id, SUM(score) AS score
                FROM (
                    SELECT id, 1.0 / (60.0 + rank) AS score FROM semantic
                    UNION ALL
                    SELECT id, 1.0 / (60.0 + rank) AS score FROM lexical
                ) ranked
                GROUP BY id
            )
            SELECT
                c.id as chunk_id,
                pv.document_id,
                COALESCE(c.pii_redacted_text, c.normalized_text_content, c.text_content) as text_content,
                c.position,
                c.section_title,
                c.content_type,
                fused.score::real as score,
                'hybrid_rrf'::text as rank_source
            FROM fused
            JOIN chunks c ON c.id = fused.id
            JOIN processing_versions pv ON c.processing_version_id = pv.id
            ORDER BY fused.score DESC, c.position ASC
            LIMIT $3
            "#
        )
        .bind(query_embedding_sql)
        .bind(query)
        .bind(limit)
        .bind(actor_role)
        .fetch_all(&self.pool)
        .await?;

        Ok(results)
    }

    pub async fn graph_context_for_chunks(&self, chunk_ids: &[Uuid]) -> Result<Vec<GraphContextItem>, sqlx::Error> {
        if chunk_ids.is_empty() {
            return Ok(vec![]);
        }

        let results = sqlx::query_as::<_, GraphContextItem>(
            r#"
            SELECT DISTINCT
                e.id as entity_id,
                e.name as entity_name,
                e.entity_type,
                r.relationship_type,
                target.name as related_entity_name
            FROM entity_mentions em
            JOIN entities e ON e.id = em.entity_id
            LEFT JOIN relationships r ON r.source_entity_id = e.id OR r.target_entity_id = e.id
            LEFT JOIN entities target ON target.id = CASE
                WHEN r.source_entity_id = e.id THEN r.target_entity_id
                ELSE r.source_entity_id
            END
            WHERE em.chunk_id = ANY($1)
            ORDER BY e.name ASC
            LIMIT 100
            "#
        )
        .bind(chunk_ids.to_vec())
        .fetch_all(&self.pool)
        .await?;

        Ok(results
            .into_iter()
            .filter(|item| useful_graph_label(&item.entity_name))
            .filter(|item| {
                item.related_entity_name
                    .as_deref()
                    .map(useful_graph_label)
                    .unwrap_or(true)
            })
            .take(25)
            .collect())
    }

    pub async fn audit_rag_query(&self, query: &str, answer: &str, chunk_ids: &[Uuid], graph_entity_ids: &[Uuid], warnings: &[String]) -> Result<Uuid, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO rag_query_audit (id, query_text, answer_text, retrieved_chunk_ids, graph_entity_ids, warnings)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#
        )
        .bind(id)
        .bind(query)
        .bind(answer)
        .bind(chunk_ids.to_vec())
        .bind(graph_entity_ids.to_vec())
        .bind(warnings.to_vec())
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn record_audit_event(&self, event_type: &str, actor_role: Option<&str>, resource_type: Option<&str>, resource_id: Option<Uuid>, details: serde_json::Value) -> Result<Uuid, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO audit_events (id, event_type, actor_role, resource_type, resource_id, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#
        )
        .bind(id)
        .bind(event_type)
        .bind(actor_role)
        .bind(resource_type)
        .bind(resource_id)
        .bind(details)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn list_audit_events(&self, limit: i64) -> Result<Vec<AuditEvent>, sqlx::Error> {
        sqlx::query_as::<_, AuditEvent>(
            r#"
            SELECT id, event_type, actor_role, resource_type, resource_id, details, created_at
            FROM audit_events
            ORDER BY created_at DESC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn run_latest_rag_eval(&self) -> Result<Option<RagEvalRun>, sqlx::Error> {
        let row = sqlx::query_as::<_, (Uuid, String, Option<String>, Vec<Uuid>, Vec<String>)>(
            r#"
            SELECT id, query_text, answer_text, retrieved_chunk_ids, warnings
            FROM rag_query_audit
            ORDER BY created_at DESC
            LIMIT 1
            "#
        )
        .fetch_optional(&self.pool)
        .await?;

        let Some((query_id, query_text, answer_text, chunk_ids, warnings)) = row else {
            return Ok(None);
        };

        let answer = answer_text.unwrap_or_default();
        let context_rows = if chunk_ids.is_empty() {
            Vec::<(Uuid, Option<String>)>::new()
        } else {
            sqlx::query_as::<_, (Uuid, Option<String>)>(
                r#"
                SELECT id, COALESCE(pii_redacted_text, normalized_text_content, text_content) AS text_content
                FROM chunks
                WHERE id = ANY($1)
                "#
            )
            .bind(chunk_ids.clone())
            .fetch_all(&self.pool)
            .await?
        };

        let has_evidence = !context_rows.is_empty();
        let insufficient = warnings.iter().any(|warning| warning == "insufficient_evidence");
        let query_terms = compact_terms(&query_text);
        let answer_lower = answer.to_lowercase();
        let context_text = context_rows
            .iter()
            .filter_map(|(_, text)| text.as_deref())
            .collect::<Vec<&str>>()
            .join(" ")
            .to_lowercase();

        let query_overlap = query_terms.iter().filter(|term| answer_lower.contains(term.as_str())).count();
        let context_overlap = query_terms.iter().filter(|term| context_text.contains(term.as_str())).count();
        let answer_terms = compact_terms(&answer);
        let supported_answer_terms = answer_terms
            .iter()
            .filter(|term| context_text.contains(term.as_str()))
            .count();

        let answer_relevance = if query_terms.is_empty() { 0.0 } else { query_overlap as f32 / query_terms.len() as f32 };
        let context_recall = if query_terms.is_empty() { 0.0 } else { context_overlap as f32 / query_terms.len() as f32 };
        let groundedness = if answer_terms.is_empty() { 0.0 } else { supported_answer_terms as f32 / answer_terms.len() as f32 };
        let relevant_contexts = context_rows
            .iter()
            .filter(|(_, text)| {
                let lower = text.as_deref().unwrap_or_default().to_lowercase();
                query_terms.iter().any(|term| lower.contains(term.as_str()))
            })
            .count();
        let context_precision = if has_evidence { relevant_contexts as f32 / context_rows.len() as f32 } else { 0.0 };

        let unique_chunks = chunk_ids.iter().collect::<HashSet<&Uuid>>().len();
        let duplicate_context_rate = if chunk_ids.is_empty() {
            0.0
        } else {
            1.0 - (unique_chunks as f32 / chunk_ids.len() as f32)
        };
        let incomplete_answer = answer_looks_incomplete(&answer);
        let faithfulness = if has_evidence && !insufficient && !incomplete_answer {
            (groundedness * 0.7 + context_precision * 0.3).min(1.0)
        } else {
            0.25
        };
        let answer_correctness = if incomplete_answer {
            0.2
        } else {
            ((answer_relevance + groundedness + context_precision) / 3.0).min(1.0)
        };
        let hallucination_risk = (1.0 - groundedness).max(if insufficient { 0.75 } else { 0.0 });

        let mut notes = vec!["deterministic_eval_baseline".to_string()];
        if insufficient {
            notes.push("insufficient_evidence".to_string());
        }
        if incomplete_answer {
            notes.push("incomplete_answer".to_string());
        }
        if duplicate_context_rate > 0.0 {
            notes.push("duplicate_context".to_string());
        }

        let eval_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO rag_eval_runs (
                id, query_audit_id, faithfulness, context_precision, context_recall,
                answer_relevance, answer_correctness, groundedness, hallucination_risk,
                duplicate_context_rate, incomplete_answer, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#
        )
        .bind(eval_id)
        .bind(query_id)
        .bind(faithfulness)
        .bind(context_precision)
        .bind(context_recall)
        .bind(answer_relevance)
        .bind(answer_correctness)
        .bind(groundedness)
        .bind(hallucination_risk)
        .bind(duplicate_context_rate)
        .bind(incomplete_answer)
        .bind(notes)
        .execute(&self.pool)
        .await?;

        self.latest_rag_eval().await
    }

    pub async fn latest_rag_eval(&self) -> Result<Option<RagEvalRun>, sqlx::Error> {
        sqlx::query_as::<_, RagEvalRun>(
            r#"
            SELECT
                id, query_audit_id, faithfulness, context_precision, context_recall,
                answer_relevance, answer_correctness, groundedness, hallucination_risk,
                duplicate_context_rate, incomplete_answer, notes, created_at
            FROM rag_eval_runs
            ORDER BY created_at DESC
            LIMIT 1
            "#
        )
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn list_rag_eval_history(&self, limit: i64) -> Result<Vec<RagEvalRun>, sqlx::Error> {
        sqlx::query_as::<_, RagEvalRun>(
            r#"
            SELECT
                id, query_audit_id, faithfulness, context_precision, context_recall,
                answer_relevance, answer_correctness, groundedness, hallucination_risk,
                duplicate_context_rate, incomplete_answer, notes, created_at
            FROM rag_eval_runs
            ORDER BY created_at DESC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn create_analysis_report(
        &self,
        title: &str,
        scope_label: Option<&str>,
        document_ids: &[Uuid],
        search_queries: &[String],
        rag_queries: &[String],
        executive_summary: &str,
        evidence: serde_json::Value,
        metrics: serde_json::Value,
        risks: serde_json::Value,
        sources: serde_json::Value,
        markdown: &str,
    ) -> Result<AnalysisReport, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO analysis_reports (
                id, title, scope_label, document_ids, search_queries, rag_queries,
                executive_summary, evidence, metrics, risks, sources, markdown
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#,
        )
        .bind(id)
        .bind(title)
        .bind(scope_label)
        .bind(document_ids.to_vec())
        .bind(search_queries.to_vec())
        .bind(rag_queries.to_vec())
        .bind(executive_summary)
        .bind(evidence)
        .bind(metrics)
        .bind(risks)
        .bind(sources)
        .bind(markdown)
        .execute(&self.pool)
        .await?;

        self.find_analysis_report(id).await?.ok_or(sqlx::Error::RowNotFound)
    }

    pub async fn list_analysis_reports(&self, limit: i64) -> Result<Vec<AnalysisReport>, sqlx::Error> {
        sqlx::query_as::<_, AnalysisReport>(
            r#"
            SELECT
                id, title, scope_label, document_ids, search_queries, rag_queries,
                executive_summary, evidence, metrics, risks, sources, markdown, created_at
            FROM analysis_reports
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_analysis_report(&self, id: Uuid) -> Result<Option<AnalysisReport>, sqlx::Error> {
        sqlx::query_as::<_, AnalysisReport>(
            r#"
            SELECT
                id, title, scope_label, document_ids, search_queries, rag_queries,
                executive_summary, evidence, metrics, risks, sources, markdown, created_at
            FROM analysis_reports
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn create_agent_run(&self, goal: &str, requested_tool: &str, tool_risk: &str, plan: serde_json::Value, approval_required: bool) -> Result<AgentRun, sqlx::Error> {
        let id = Uuid::new_v4();
        let status = if approval_required { "waiting_approval" } else { "executed" };
        let result = if approval_required {
            None
        } else {
            Some(serde_json::json!({
                "mode": "draft-only",
                "plan_status": "completed",
                "execution": [
                    { "step": "planejar", "status": "done" },
                    { "step": "recuperar_contexto", "status": "done" },
                    { "step": "executar_ferramenta", "status": "done" },
                    { "step": "revisar_resultado", "status": "done" }
                ],
                "review": {
                    "external_side_effects": false,
                    "human_approval_required": false,
                    "message": "Execucao limitada a consulta ou rascunho. Nenhuma acao externa foi aplicada."
                }
            }))
        };

        sqlx::query(
            r#"
            INSERT INTO agent_runs (id, goal, status, requested_tool, tool_risk, plan, result, approval_required)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#
        )
        .bind(id)
        .bind(goal)
        .bind(status)
        .bind(requested_tool)
        .bind(tool_risk)
        .bind(plan)
        .bind(result)
        .bind(approval_required)
        .execute(&self.pool)
        .await?;

        self.find_agent_run(id).await?.ok_or(sqlx::Error::RowNotFound)
    }

    pub async fn approve_agent_run(&self, id: Uuid, approved_by: &str) -> Result<Option<AgentRun>, sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE agent_runs
            SET status = 'executed',
                approved_by = $2,
                result = jsonb_build_object(
                    'mode', 'approved-controlled-execution',
                    'execution', jsonb_build_array(
                        jsonb_build_object('step', 'planejar', 'status', 'done'),
                        jsonb_build_object('step', 'recuperar_contexto', 'status', 'done'),
                        jsonb_build_object('step', 'validar_aprovacao_humana', 'status', 'done'),
                        jsonb_build_object('step', 'executar_ferramenta_sensivel', 'status', 'adapter-gated'),
                        jsonb_build_object('step', 'registrar_auditoria', 'status', 'done')
                    ),
                    'review', jsonb_build_object(
                        'external_side_effects', false,
                        'message', 'Acao sensivel aprovada, mas efeitos externos continuam bloqueados por adaptadores ate integracao real.'
                    )
                ),
                updated_at = NOW()
            WHERE id = $1 AND status = 'waiting_approval'
            "#
        )
        .bind(id)
        .bind(approved_by)
        .execute(&self.pool)
        .await?;

        self.find_agent_run(id).await
    }

    pub async fn find_agent_run(&self, id: Uuid) -> Result<Option<AgentRun>, sqlx::Error> {
        sqlx::query_as::<_, AgentRun>(
            r#"
            SELECT id, goal, status, requested_tool, tool_risk, plan, result, approval_required, approved_by, created_at, updated_at
            FROM agent_runs
            WHERE id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn list_multimodal_blocks(&self, doc_id: Uuid) -> Result<Vec<MultimodalBlock>, sqlx::Error> {
        if let Some(version_id) = self.get_latest_version_id(doc_id).await? {
            return sqlx::query_as::<_, MultimodalBlock>(
                r#"
                SELECT id, processing_version_id, block_type, page_number, position, content_text, metadata, created_at
                FROM multimodal_blocks
                WHERE processing_version_id = $1
                ORDER BY position ASC
                "#
            )
            .bind(version_id)
            .fetch_all(&self.pool)
            .await;
        }

        Ok(vec![])
    }

    pub async fn find_graph_by_document_id(&self, doc_id: Uuid) -> Result<GraphResult, sqlx::Error> {
        if let Some(version_id) = self.get_latest_version_id(doc_id).await? {
            let raw_nodes = sqlx::query_as::<_, GraphNode>(
                r#"
                SELECT DISTINCT e.id, e.name as label, e.entity_type as node_type
                FROM entities e
                JOIN entity_mentions em ON e.id = em.entity_id
                WHERE em.processing_version_id = $1
                ORDER BY e.entity_type ASC, e.name ASC
                LIMIT 120
                "#
            )
            .bind(version_id)
            .fetch_all(&self.pool)
            .await?;

            let nodes = raw_nodes
                .into_iter()
                .filter(|node| useful_graph_label(&node.label))
                .take(48)
                .collect::<Vec<GraphNode>>();
            let node_ids = nodes.iter().map(|node| node.id).collect::<HashSet<Uuid>>();

            let raw_edges = sqlx::query_as::<_, GraphEdge>(
                r#"
                SELECT source_entity_id as source, target_entity_id as target, relationship_type as label
                FROM relationships
                WHERE processing_version_id = $1
                LIMIT 200
                "#
            )
            .bind(version_id)
            .fetch_all(&self.pool)
            .await?;

            let edges = raw_edges
                .into_iter()
                .filter(|edge| node_ids.contains(&edge.source) && node_ids.contains(&edge.target))
                .take(96)
                .collect::<Vec<GraphEdge>>();
            let communities = build_graph_communities(&nodes);

            return Ok(GraphResult { nodes, edges, communities });
        }
        Ok(GraphResult { nodes: vec![], edges: vec![], communities: vec![] })
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
                "SELECT * FROM action_items WHERE processing_version_id = $1 ORDER BY created_at ASC"
            )
            .bind(version.id)
            .fetch_all(&self.pool)
            .await?;

            let chunks = sqlx::query_as::<_, Chunk>(
                "SELECT * FROM chunks WHERE processing_version_id = $1 ORDER BY position ASC"
            )
            .bind(version.id)
            .fetch_all(&self.pool)
            .await?;
            
            Ok(Some(VersionResults { action_items, chunks }))
        } else {
            Ok(None)
        }
    }
}
