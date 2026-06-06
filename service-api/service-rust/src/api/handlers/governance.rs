use actix_web::{web, HttpResponse, Responder, get, post};
use serde::{Deserialize, Serialize};
use crate::infrastructure::persistence::postgres::PostgresRepository;

#[derive(Deserialize)]
pub struct AuditQuery {
    limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct RagEvalHistoryQuery {
    limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct RedactRequest {
    text: String,
}

#[derive(Serialize)]
struct PiiFinding {
    pii_type: String,
    sample: String,
}

#[derive(Serialize)]
struct RedactResponse {
    redacted_text: String,
    findings: Vec<PiiFinding>,
}

fn redact_pii(text: &str) -> RedactResponse {
    let patterns = [
        ("CPF", r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
        ("CNPJ", r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b"),
        ("EMAIL", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        ("PHONE", r"\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b"),
        ("CARD", r"\b(?:\d[ -]*?){13,16}\b"),
    ];

    let mut redacted = text.to_string();
    let mut findings = Vec::new();

    for (pii_type, pattern) in patterns {
        let regex = regex::Regex::new(pattern).expect("valid pii regex");
        for value in regex.find_iter(text) {
            findings.push(PiiFinding {
                pii_type: pii_type.to_string(),
                sample: format!("{}***", value.as_str().chars().take(4).collect::<String>()),
            });
        }
        redacted = regex.replace_all(&redacted, format!("[REDACTED_{}]", pii_type)).to_string();
    }

    RedactResponse { redacted_text: redacted, findings }
}

#[post("/governance/pii/redact")]
pub async fn redact(req: web::Json<RedactRequest>) -> impl Responder {
    HttpResponse::Ok().json(redact_pii(&req.text))
}

#[get("/governance/audit")]
pub async fn list_audit(
    query: web::Query<AuditQuery>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    match repo.list_audit_events(query.limit.unwrap_or(50)).await {
        Ok(events) => HttpResponse::Ok().json(events),
        Err(e) => {
            eprintln!("Failed to list audit events: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[post("/observability/rag/evaluate")]
pub async fn evaluate_rag(repo: web::Data<PostgresRepository>) -> impl Responder {
    match repo.run_latest_rag_eval().await {
        Ok(Some(result)) => HttpResponse::Ok().json(result),
        Ok(None) => HttpResponse::NotFound().body("No RAG query audit found."),
        Err(e) => {
            eprintln!("Failed to evaluate RAG: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[get("/observability/rag/latest")]
pub async fn latest_rag_eval(repo: web::Data<PostgresRepository>) -> impl Responder {
    match repo.latest_rag_eval().await {
        Ok(Some(result)) => HttpResponse::Ok().json(result),
        Ok(None) => HttpResponse::NotFound().body("No RAG eval run found."),
        Err(e) => {
            eprintln!("Failed to fetch latest RAG eval: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[get("/observability/rag/history")]
pub async fn rag_eval_history(
    query: web::Query<RagEvalHistoryQuery>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    match repo.list_rag_eval_history(query.limit.unwrap_or(25)).await {
        Ok(results) => HttpResponse::Ok().json(results),
        Err(e) => {
            eprintln!("Failed to fetch RAG eval history: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}
