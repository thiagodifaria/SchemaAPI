pub mod rabbitmq;

use crate::infrastructure::messaging::rabbitmq::RabbitMQPublisher;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub enum IngestionPublisher {
    RabbitMQ(RabbitMQPublisher),
    PostgresJobs(PgPool),
}

impl IngestionPublisher {
    pub fn postgres_jobs(pool: PgPool) -> Self {
        Self::PostgresJobs(pool)
    }

    pub fn rabbitmq(publisher: RabbitMQPublisher) -> Self {
        Self::RabbitMQ(publisher)
    }

    pub async fn publish_ingestion_job(
        &self,
        document_id: Uuid,
        processing_version_id: Uuid,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match self {
            Self::RabbitMQ(publisher) => {
                publisher
                    .publish_ingestion_job(document_id, processing_version_id)
                    .await?;
            }
            Self::PostgresJobs(pool) => {
                sqlx::query(
                    r#"
                    INSERT INTO desktop_ingestion_jobs (
                        document_id, processing_version_id, status, attempts, created_at, updated_at
                    )
                    VALUES ($1, $2, 'pending', 0, NOW(), NOW())
                    ON CONFLICT (processing_version_id)
                    DO UPDATE SET
                        status = 'pending',
                        locked_at = NULL,
                        locked_by = NULL,
                        last_error = NULL,
                        updated_at = NOW()
                    "#,
                )
                .bind(document_id)
                .bind(processing_version_id)
                .execute(pool)
                .await?;
            }
        }
        Ok(())
    }
}
