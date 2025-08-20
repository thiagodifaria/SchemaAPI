use actix_web::{web, HttpResponse, Responder, get};
use serde::Deserialize;
use uuid::Uuid;
use crate::{
    infrastructure::persistence::postgres_repository::PostgresRepository,
    domain::service::diff_service,
};

#[derive(Deserialize)]
pub struct DiffParams {
    from_version: i32,
    to_version: i32,
}

#[get("/documents/{id}/diff")]
pub async fn get_document_diff(
    path: web::Path<Uuid>,
    query: web::Query<DiffParams>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    let doc_id = path.into_inner();

    let from_results = match repo.find_results_by_version_number(doc_id, query.from_version).await {
        Ok(Some(results)) => results,
        Ok(None) => return HttpResponse::NotFound().body(format!("Version {} not found.", query.from_version)),
        Err(_) => return HttpResponse::InternalServerError().finish(),
    };

    let to_results = match repo.find_results_by_version_number(doc_id, query.to_version).await {
        Ok(Some(results)) => results,
        Ok(None) => return HttpResponse::NotFound().body(format!("Version {} not found.", query.to_version)),
        Err(_) => return HttpResponse::InternalServerError().finish(),
    };
    
    // For now, the diff only compares ActionItems
    let action_items_diff = diff_service::compare_action_items(from_results.action_items, to_results.action_items);

    let diff_result = diff_service::StructuralDiff {
        action_items_diff,
    };

    HttpResponse::Ok().json(diff_result)
}