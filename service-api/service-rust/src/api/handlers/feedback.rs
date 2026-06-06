use actix_web::{web, HttpResponse, Responder, post};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use sqlx::PgPool;

#[derive(Deserialize)]
pub struct FeedbackRequest {
    prediction_id: Uuid,
    prediction_type: String,
    feedback_type: String,
    original_data: Option<Value>,
    corrected_data: Value,
    user_context: Option<String>,
}

#[post("/feedback")]
pub async fn submit_feedback(
    req: web::Json<FeedbackRequest>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let feedback_id = Uuid::new_v4();

    let result = sqlx::query(
        r#"
        INSERT INTO feedback (id, prediction_id, prediction_type, feedback_type, original_data, corrected_data, user_context, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        "#
    )
    .bind(feedback_id)
    .bind(req.prediction_id)
    .bind(&req.prediction_type)
    .bind(&req.feedback_type)
    .bind(&req.original_data)
    .bind(&req.corrected_data)
    .bind(&req.user_context)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({ "feedback_id": feedback_id })),
        Err(e) => {
            eprintln!("Failed to save feedback: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}