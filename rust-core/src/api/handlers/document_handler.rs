use actix_web::{web, HttpResponse, Responder, post, get};
use actix_multipart::Multipart;
use futures_util::TryStreamExt;
use serde::Deserialize;
use uuid::Uuid;
use chrono::Utc;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use crate::{
    infrastructure::{
        persistence::postgres_repository::{PostgresRepository, RawFile},
        messaging::rabbitmq_publisher::RabbitMQPublisher,
    },
    domain::model::document::{Document, ClassificationExample},
};

#[derive(Deserialize)]
pub struct SearchRequest {
    pub query: String,
}

#[derive(Deserialize)]
struct VectorizeResponse {
    vector: Vec<f32>,
}

#[derive(Deserialize, Default)]
struct IngestionMetadata {
    classification_examples: Option<Vec<ClassificationExample>>,
}

#[post("/documents")]
pub async fn ingest_document(
    mut payload: Multipart,
    repo: web::Data<PostgresRepository>,
    publisher: web::Data<RabbitMQPublisher>,
) -> impl Responder {
    let mut file_content: Option<Vec<u8>> = None;
    let mut file_name = String::new();
    let mut mime_type = String::new();
    let mut metadata: IngestionMetadata = IngestionMetadata::default();

    while let Some(mut field) = payload.try_next().await.unwrap_or(None) {
        let field_name = field.name().unwrap_or("").to_string();
        let disposition = field.content_disposition().clone();
        
        let mut field_bytes = Vec::new();
        while let Some(chunk) = field.try_next().await.unwrap_or(None) {
            field_bytes.extend_from_slice(&chunk);
        }

        if field_name == "metadata" {
            metadata = serde_json::from_slice(&field_bytes).unwrap_or_default();
        } else {
            file_name = disposition.get_filename().unwrap_or("unknown_file").to_string();
            mime_type = field.content_type().map(|m| m.to_string()).unwrap_or("application/octet-stream".to_string());
            file_content = Some(field_bytes);
        }
    }

    let final_file_content = match file_content {
        Some(content) => content,
        None => return HttpResponse::BadRequest().body("File part is required."),
    };

    let mut hasher = DefaultHasher::new();
    final_file_content.hash(&mut hasher);
    let source_hash = format!("{:x}", hasher.finish());

    let doc_id_for_insert = Uuid::new_v4();
    let now = Utc::now();

    let document = Document { id: doc_id_for_insert, source_hash, created_at: now, updated_at: now };
    let raw_file = RawFile { file_name: &file_name, mime_type: &mime_type, content: &final_file_content };
    let examples = metadata.classification_examples.unwrap_or_default();

    match repo.ingest_new_file(&document, &raw_file, &examples).await {
        Ok((document_id, processing_version_id)) => {
            if let Err(e) = publisher.publish_ingestion_job(document_id, processing_version_id).await {
                eprintln!("Failed to publish ingestion job: {}", e);
                return HttpResponse::InternalServerError().finish();
            }
            HttpResponse::Accepted().json(serde_json::json!({ "document_id": document_id }))
        }
        Err(e) => {
            eprintln!("Failed to create document: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[get("/documents/{id}")]
pub async fn get_document(
    path: web::Path<Uuid>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    let doc_id = path.into_inner();
    
    match repo.find_document_by_id(doc_id).await {
        Ok(Some(result)) => HttpResponse::Ok().json(result),
        Ok(None) => HttpResponse::NotFound().finish(),
        Err(e) => {
            eprintln!("Failed to fetch document: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[post("/search")]
pub async fn search_by_text(
    req: web::Json<SearchRequest>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    let client = reqwest::Client::new();
    let vectorize_url = "http://python-api-service:8001/vectorize";

    let vectorize_res = match client.post(vectorize_url)
        .json(&serde_json::json!({ "text": req.query }))
        .send()
        .await 
    {
        Ok(res) => res,
        Err(e) => {
            eprintln!("Failed to call vectorization service: {}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };
    
    if !vectorize_res.status().is_success() {
        eprintln!("Vectorization service returned an error: {}", vectorize_res.status());
        return HttpResponse::InternalServerError().finish();
    }

    let query_vector = match vectorize_res.json::<VectorizeResponse>().await {
        Ok(body) => body.vector,
        Err(e) => {
            eprintln!("Failed to parse vectorization response: {}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };
    
    match repo.search_chunks_semantic(&query_vector).await {
        Ok(results) => HttpResponse::Ok().json(results),
        Err(e) => {
            eprintln!("Failed to execute search: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[get("/health")]
pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().body("OK")
}