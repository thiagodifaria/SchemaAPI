use actix_web::{web, HttpResponse, Responder, get};
use uuid::Uuid;
use crate::infrastructure::persistence::postgres_repository::PostgresRepository;

#[get("/documents/{id}/graph")]
pub async fn get_document_graph(
    path: web::Path<Uuid>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    let doc_id = path.into_inner();

    match repo.find_graph_by_document_id(doc_id).await {
        Ok(graph_result) => HttpResponse::Ok().json(graph_result),
        Err(e) => {
            eprintln!("Failed to fetch document graph: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}