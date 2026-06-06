use actix_web::{web, HttpResponse, Responder, get, post};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::infrastructure::persistence::postgres::PostgresRepository;

#[derive(Serialize)]
struct AgentTool {
    name: &'static str,
    risk: &'static str,
    description: &'static str,
}

#[derive(Deserialize)]
pub struct CreateAgentRunRequest {
    goal: String,
    requested_tool: Option<String>,
}

#[derive(Deserialize)]
pub struct ApproveAgentRunRequest {
    approved_by: String,
}

fn tool_risk(tool: &str) -> &'static str {
    match tool {
        "query_documents" | "query_graph" => "read-only",
        "draft_email" | "create_review_item" => "draft-only",
        "compare_invoice_purchase_order" => "mutation-sensitive",
        _ => "draft-only",
    }
}

fn approval_required(risk: &str) -> bool {
    matches!(risk, "mutation-sensitive")
}

#[get("/agents/tools")]
pub async fn list_tools() -> impl Responder {
    HttpResponse::Ok().json(vec![
        AgentTool { name: "query_documents", risk: "read-only", description: "Retrieve document evidence." },
        AgentTool { name: "query_graph", risk: "read-only", description: "Inspect related entities and relationships." },
        AgentTool { name: "draft_email", risk: "draft-only", description: "Create a draft message without sending it." },
        AgentTool { name: "create_review_item", risk: "draft-only", description: "Prepare a review queue item." },
        AgentTool { name: "compare_invoice_purchase_order", risk: "mutation-sensitive", description: "Compare fiscal/financial evidence and require approval before external action." },
    ])
}

#[post("/agents/runs")]
pub async fn create_agent_run(
    req: web::Json<CreateAgentRunRequest>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    let goal = req.goal.clone();
    let tool = req.requested_tool.clone().unwrap_or_else(|| "query_documents".to_string());
    let risk = tool_risk(&tool);
    let plan = serde_json::json!({
        "goal": goal,
        "tool": tool.clone(),
        "risk": risk,
        "steps": [
            { "name": "planejar", "purpose": "decompor objetivo e selecionar ferramenta segura" },
            { "name": "recuperar_contexto", "purpose": "buscar evidencias documentais antes de agir" },
            { "name": "executar_ferramenta", "purpose": "executar apenas consulta, rascunho ou acao aprovada" },
            { "name": "revisar_resultado", "purpose": "verificar evidencia, risco e necessidade de aprovacao" },
            { "name": "human_in_the_loop", "purpose": "pausar acoes sensiveis ate aprovacao humana" }
        ],
        "controls": {
            "requires_evidence": true,
            "records_audit": true,
            "external_side_effects": "blocked_until_adapter"
        }
    });

    match repo.create_agent_run(&goal, &tool, risk, plan, approval_required(risk)).await {
        Ok(run) => {
            if let Err(e) = repo.record_audit_event(
                "agent.run.created",
                Some("operator"),
                Some("agent_run"),
                Some(run.id),
                serde_json::json!({
                    "goal": run.goal.clone(),
                    "tool": run.requested_tool.clone(),
                    "risk": run.tool_risk.clone(),
                    "approval_required": run.approval_required,
                }),
            ).await {
                eprintln!("Failed to record agent audit event: {}", e);
            }
            HttpResponse::Accepted().json(run)
        },
        Err(e) => {
            eprintln!("Failed to create agent run: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[post("/agents/runs/{id}/approve")]
pub async fn approve_agent_run(
    path: web::Path<Uuid>,
    req: web::Json<ApproveAgentRunRequest>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    match repo.approve_agent_run(path.into_inner(), &req.approved_by).await {
        Ok(Some(run)) => {
            if let Err(e) = repo.record_audit_event(
                "agent.run.approved",
                Some(&req.approved_by),
                Some("agent_run"),
                Some(run.id),
                serde_json::json!({
                    "tool": run.requested_tool.clone(),
                    "risk": run.tool_risk.clone(),
                    "status": run.status.clone(),
                }),
            ).await {
                eprintln!("Failed to record agent approval audit event: {}", e);
            }
            HttpResponse::Ok().json(run)
        },
        Ok(None) => HttpResponse::NotFound().finish(),
        Err(e) => {
            eprintln!("Failed to approve agent run: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[get("/agents/runs/{id}")]
pub async fn get_agent_run(
    path: web::Path<Uuid>,
    repo: web::Data<PostgresRepository>,
) -> impl Responder {
    match repo.find_agent_run(path.into_inner()).await {
        Ok(Some(run)) => HttpResponse::Ok().json(run),
        Ok(None) => HttpResponse::NotFound().finish(),
        Err(e) => {
            eprintln!("Failed to fetch agent run: {}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}
