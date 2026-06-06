use actix_web::{get, web, HttpResponse, Responder};

use crate::infrastructure::persistence::postgres::PostgresRepository;

#[get("/contexts/auto")]
pub async fn list_auto_contexts(repo: web::Data<PostgresRepository>) -> impl Responder {
    match repo.list_auto_contexts().await {
        Ok(contexts) => HttpResponse::Ok().json(contexts),
        Err(error) => {
            eprintln!("Failed to infer automatic contexts: {}", error);
            HttpResponse::InternalServerError().finish()
        }
    }
}
