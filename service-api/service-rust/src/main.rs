use actix_web::{web, App, HttpServer};
use sqlx::PgPool;
use serde::Deserialize;
use std::time::Duration;

mod api;
mod domain;
mod infrastructure;

use api::handlers::{
    document::{health_check, ingest_document, get_document, search_by_text, search_lexical, search_hybrid, rag_query, ingest_from_url},
    feedback::submit_feedback,
    graph::get_document_graph,
    diff::get_document_diff,
    governance::{redact, list_audit, evaluate_rag, latest_rag_eval, rag_eval_history},
    agent::{list_tools, create_agent_run, approve_agent_run, get_agent_run},
    analysis::{create_analysis_report, list_analysis_reports, get_analysis_report, export_analysis_report},
    context::list_auto_contexts,
    multimodal::get_document_multimodal_blocks,
};
use infrastructure::{
    persistence::postgres::PostgresRepository,
    messaging::{rabbitmq::RabbitMQPublisher, IngestionPublisher},
};

#[derive(Deserialize)]
struct ApiSettings { host: String, port: u16 }
#[derive(Deserialize)]
struct DatabaseSettings { url: String }
#[derive(Deserialize)]
struct RabbitMQSettings { url: String }
#[derive(Deserialize, Default)]
struct RuntimeSettings { mode: Option<String> }
#[derive(Deserialize)]
struct Settings {
    api: ApiSettings,
    database: DatabaseSettings,
    rabbitmq: Option<RabbitMQSettings>,
    runtime: Option<RuntimeSettings>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config_builder = config::Config::builder()
        .add_source(config::Environment::default().separator("__"))
        .build()
        .expect("Failed to build configuration");

    println!("Internal configuration detected: {:?}", config_builder);

    let settings = config_builder
        .try_deserialize::<Settings>()
        .expect("Failed to deserialize configuration");

    let db_pool = PgPool::connect(&settings.database.url)
        .await
        .expect("Failed to create database pool.");

    let runtime_mode = std::env::var("SCHEMA_RUNTIME").unwrap_or_else(|_| {
        settings
        .runtime
        .as_ref()
        .and_then(|runtime| runtime.mode.as_deref())
        .unwrap_or("docker")
        .to_string()
    }).to_ascii_lowercase();

    let ingestion_publisher = if runtime_mode == "desktop" {
        println!("Using PostgreSQL desktop ingestion queue.");
        IngestionPublisher::postgres_jobs(db_pool.clone())
    } else {
        let rabbitmq_url = settings
            .rabbitmq
            .as_ref()
            .map(|rabbitmq| rabbitmq.url.as_str())
            .expect("RABBITMQ__URL is required unless SCHEMA_RUNTIME=desktop");

        // Compose can mark RabbitMQ healthy before AMQP accepts connections, so the API
        // retries here instead of failing a clean local startup.
        let mut rabbitmq_result = None;
        for attempt in 1..=10 {
            match RabbitMQPublisher::new(rabbitmq_url).await {
                Ok(publisher) => {
                    rabbitmq_result = Some(publisher);
                    break;
                }
                Err(e) => {
                    eprintln!("Failed to connect to RabbitMQ on attempt {}: {}", attempt, e);
                    tokio::time::sleep(Duration::from_secs(3)).await;
                }
            }
        }
        IngestionPublisher::rabbitmq(
            rabbitmq_result.expect("Failed to connect to RabbitMQ after retries"),
        )
    };

    let server_address = format!("{}:{}", settings.api.host, settings.api.port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(PostgresRepository::new(db_pool.clone())))
            .app_data(web::Data::new(ingestion_publisher.clone()))
            .app_data(web::Data::new(db_pool.clone()))
            .service(health_check)
            .service(ingest_document)
            .service(ingest_from_url)
            .service(get_document)
            .service(search_by_text)
            .service(search_lexical)
            .service(search_hybrid)
            .service(rag_query)
            .service(submit_feedback)
            .service(get_document_graph)
            .service(get_document_diff)
            .service(list_auto_contexts)
            .service(redact)
            .service(list_audit)
            .service(evaluate_rag)
            .service(latest_rag_eval)
            .service(rag_eval_history)
            .service(list_tools)
            .service(create_agent_run)
            .service(approve_agent_run)
            .service(get_agent_run)
            .service(create_analysis_report)
            .service(list_analysis_reports)
            .service(get_analysis_report)
            .service(export_analysis_report)
            .service(get_document_multimodal_blocks)
    })
    .bind(server_address)?
    .run()
    .await
}
