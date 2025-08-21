import pika
import os
import sys
import json
import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json

from pipelines.temporal_analysis import temporal_analysis_pipeline
from pipelines.template_detection import template_detection_pipeline
from pipelines.feedback_analysis import feedback_analysis_pipeline
from pipelines.retraining import retraining_pipeline

def get_db_connection():
    return psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB"),
        user=os.environ.get("POSTGRES_USER"),
        password=os.environ.get("POSTGRES_PASSWORD"),
        host=os.environ.get("DB_HOST")
    )

def run_temporal_analysis():
    conn = get_db_connection()
    try:
        patterns = temporal_analysis_pipeline.detect_recurring_topics(conn)
        if not patterns:
            print("No new temporal patterns detected.")
            return

        with conn.cursor() as cur:
            for pattern in patterns:
                cur.execute(
                    sql.SQL("""
                        INSERT INTO temporal_patterns (id, pattern_type, topic, period, confidence, last_detected_at)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                        ON CONFLICT (pattern_type, topic) DO UPDATE SET
                        period = EXCLUDED.period,
                        confidence = EXCLUDED.confidence,
                        last_detected_at = NOW();
                    """),
                    (pattern['pattern_type'], pattern['topic'], pattern['period'], pattern['confidence'])
                )
            conn.commit()
        print(f"Detected and saved {len(patterns)} temporal patterns.")
    except Exception as e:
        print(f"Error during temporal analysis: {e}")
        conn.rollback()
    finally:
        conn.close()

def run_template_detection():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pv.id, rf.content
                FROM processing_versions pv
                JOIN raw_files rf ON pv.id = rf.processing_version_id
                LEFT JOIN document_structures ds ON pv.id = ds.processing_version_id
                WHERE ds.id IS NULL AND rf.mime_type NOT LIKE '%%csv%%' AND rf.mime_type NOT LIKE '%%spreadsheet%%';
            """)
            
            versions_to_process = cur.fetchall()
            if not versions_to_process:
                print("No new document structures to detect.")
                return

            count = 0
            for version_id, content_bytes in versions_to_process:
                text = content_bytes.decode('utf-8', errors='ignore')
                result = template_detection_pipeline.extract_features(text)
                cur.execute(
                    sql.SQL("INSERT INTO document_structures (id, processing_version_id, features, structure_hash) VALUES (gen_random_uuid(), %s, %s, %s)"),
                    (version_id, Json(result['features']), result['structure_hash'])
                )
                count += 1

            conn.commit()
            print(f"Processed and saved {count} document structures.")
    except Exception as e:
        print(f"Error during template detection: {e}")
        conn.rollback()
    finally:
        conn.close()

def run_feedback_analysis():
    conn = get_db_connection()
    try:
        aggregated_errors, processed_ids = feedback_analysis_pipeline.analyze_feedback(conn)
        if not processed_ids:
            print("No new feedback to analyze.")
            return
            
        with conn.cursor() as cur:
            for error_type, data in aggregated_errors.items():
                cur.execute(
                    sql.SQL("""
                        INSERT INTO error_patterns (id, prediction_type, error_type, occurrence_count, last_seen_at, example_feedback_ids)
                        VALUES (gen_random_uuid(), %s, %s, %s, NOW(), %s)
                        ON CONFLICT (prediction_type, error_type) DO UPDATE SET
                        occurrence_count = error_patterns.occurrence_count + EXCLUDED.occurrence_count,
                        last_seen_at = NOW(),
                        example_feedback_ids = EXCLUDED.example_feedback_ids;
                    """),
                    ('action_item', error_type, data['count'], data['examples'])
                )
            
            cur.execute(
                sql.SQL("UPDATE feedback SET is_analyzed = TRUE WHERE id = ANY(%s)"),
                (processed_ids,)
            )
            conn.commit()
        print(f"Analyzed {len(processed_ids)} feedback entries and updated {len(aggregated_errors)} error patterns.")
    except Exception as e:
        print(f"Error during feedback analysis: {e}")
        conn.rollback()
    finally:
        conn.close()

def run_template_creation():
    conn = get_db_connection()
    try:
        created_templates = template_creation_pipeline.create_templates_from_structures(conn)
        if created_templates:
            print(f"Successfully created {len(created_templates)} new document templates.")
        else:
            print("No new templates were created based on current document structures.")
    except Exception as e:
        print(f"Error during template creation: {e}")
    finally:
        conn.close()

def run_retraining_job():
    conn = get_db_connection()
    try:
        retraining_pipeline.trigger_retraining(conn)
    except Exception as e:
        print(f"Error during retraining job simulation: {e}")
    finally:
        conn.close()

def main():
    rabbitmq_host = os.environ.get('RABBITMQ_HOST', 'rabbitmq')
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host))
    channel = connection.channel()
    
    queue_name = 'analytics_queue'
    channel.queue_declare(queue=queue_name, durable=True)

    def callback(ch, method, properties, body):
        try:
            message = json.loads(body.decode('utf-8'))
            print(f"Received analytics job: {message}")
            
            job_type = message.get("job_type")
            if job_type == "detect_temporal_patterns":
                run_temporal_analysis()
            elif job_type == "detect_document_structures":
                run_template_detection()
            elif job_type == "analyze_feedback":
                run_feedback_analysis()
            elif job_type == "create_templates":
                run_template_creation()
            elif job_type == "trigger_retraining":
                run_retraining_job()
            else:
                print(f"Unknown job type: {job_type}")

        except Exception as e:
            print(f"Failed to process analytics job: {e}")
        
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    print('Analytics worker started. Waiting for analytics jobs.')
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Analytics worker stopped.')
        sys.exit(0)