use actix_web::{web, HttpResponse, Responder, get};
use uuid::Uuid;
use crate::infrastructure::persistence::postgres::PostgresRepository;

#[get("/documents/{id}/multimodal")]
pub async fn get_document_multimodal_blocks(
    path: web::Path<Uuid>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    match repo.list_multimodal_blocks(path.into_inner()).await {
        Ok(blocks) => HttpResponse::Ok().json(blocks),
        Err(e) => {
            eprintln!("Failed to fetch multimodal blocks: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}
