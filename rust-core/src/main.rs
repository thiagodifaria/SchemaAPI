use actix_web::{web, App, HttpServer};
use sqlx::PgPool;
use serde::Deserialize;

mod api;
mod domain;
mod infrastructure;

use api::handlers::{
    document_handler::{health_check, ingest_document, get_document, search_by_text},
    feedback_handler::submit_feedback,
    graph_handler::get_document_graph,
    diff_handler::get_document_diff,
};
use infrastructure::{
    persistence::postgres_repository::PostgresRepository,
    messaging::rabbitmq_publisher::RabbitMQPublisher,
};

#[derive(Deserialize)]
struct ApiSettings { host: String, port: u16 }
#[derive(Deserialize)]
struct DatabaseSettings { url: String }
#[derive(Deserialize)]
struct RabbitMQSettings { url: String }
#[derive(Deserialize)]
struct Settings { api: ApiSettings, database: DatabaseSettings, rabbitmq: RabbitMQSettings }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let settings = config::Config::builder()
        .add_source(config::File::with_name("config/development"))
        .build()
        .expect("Failed to build configuration")
        .try_deserialize::<Settings>()
        .expect("Failed to deserialize configuration");

    let db_pool = PgPool::connect(&settings.database.url)
        .await
        .expect("Failed to create database pool.");

    let rabbitmq_publisher = RabbitMQPublisher::new(&settings.rabbitmq.url)
        .await
        .expect("Failed to connect to RabbitMQ");

    let server_address = format!("{}:{}", settings.api.host, settings.api.port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(PostgresRepository::new(db_pool.clone())))
            .app_data(web::Data::new(rabbitmq_publisher.clone()))
            .app_data(web::Data::new(db_pool.clone()))
            .service(health_check)
            .service(ingest_document)
            .service(get_document)
            .service(search_by_text)
            .service(submit_feedback)
            .service(get_document_graph)
            .service(get_document_diff)
    })
    .bind(server_address)?
    .run()
    .await
}