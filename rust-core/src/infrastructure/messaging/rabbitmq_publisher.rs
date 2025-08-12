use lapin::{
    options::{BasicPublishOptions, QueueDeclareOptions},
    protocol::basic::AMQPProperties,
    Connection, ConnectionProperties, Result,
};
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
struct JobMessage {
    document_id: Uuid,
    processing_version_id: Uuid,
}

#[derive(Clone)]
pub struct RabbitMQPublisher {
    conn: Connection,
}

impl RabbitMQPublisher {
    pub async fn new(uri: &str) -> Result<Self> {
        let conn = Connection::connect(uri, ConnectionProperties::default()).await?;
        Ok(Self { conn })
    }

    pub async fn publish_ingestion_job(&self, document_id: Uuid, processing_version_id: Uuid) -> Result<()> {
        let channel = self.conn.create_channel().await?;
        let queue_name = "ingestion_queue";

        channel
            .queue_declare(
                queue_name,
                QueueDeclareOptions { durable: true, ..Default::default() },
                Default::default(),
            )
            .await?;

        let message = JobMessage { document_id, processing_version_id };
        let payload = serde_json::to_string(&message).unwrap_or_default().into_bytes();
        let props = AMQPProperties::default().with_content_type("application/json".into());

        channel
            .basic_publish(
                "",
                queue_name,
                BasicPublishOptions::default(),
                &payload,
                props,
            )
            .await?;

        Ok(())
    }
}