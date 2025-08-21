import pika
import os
import sys
import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json
from sentence_transformers import SentenceTransformer
import fitz
import docx
import io
import re
import itertools
import json
import requests
from bs4 import BeautifulSoup

from pipelines.summarization import summarization_pipeline
from pipelines.action_item_extraction import action_item_extraction_pipeline
from pipelines.topic_extraction import topic_extraction_pipeline
from pipelines.knowledge_graph_extraction import knowledge_graph_pipeline
from pipelines.classification import classification_pipeline
from pipelines.tabular_processing import tabular_processing_pipeline
from pipelines.finance_ner import finance_ner_pipeline
from pipelines.finance_kpi_extractor import finance_kpi_extractor_pipeline
from pipelines.finance_risk_classifier import finance_risk_classifier_pipeline

embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

def extract_text_from_pdf(content: bytes) -> str:
    with fitz.open(stream=content, filetype="pdf") as doc:
        return "".join(page.get_text() for page in doc)

def extract_text_from_docx(content_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(content_bytes))
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_url(url: str) -> str:
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        return soup.get_text(separator='\n', strip=True)
    except requests.RequestException as e:
        print(f"Failed to download or parse URL {url}: {e}")
        return ""

def intelligent_chunking(text: str, chunk_size=300, overlap=50) -> list:
    words = text.split()
    if not words:
        return []
    
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        start += chunk_size - overlap
    return chunks

def get_db_connection():
    return psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB"),
        user=os.environ.get("POSTGRES_USER"),
        password=os.environ.get("POSTGRES_PASSWORD"),
        host=os.environ.get("DB_HOST")
    )

def process_unstructured_job(cur, document_id, processing_version_id, text):
    chunk_texts_unsplit = intelligent_chunking(text)
    if not chunk_texts_unsplit:
        cur.execute(sql.SQL("UPDATE processing_versions SET status = %s WHERE id = %s"), ('Failed_NoContent', processing_version_id))
        return

    for i, chunk_text in enumerate(chunk_texts_unsplit):
        cur.execute(sql.SQL("INSERT INTO chunks (id, processing_version_id, text_content, position, token_count) VALUES (gen_random_uuid(), %s, %s, %s, %s)"), (processing_version_id, chunk_text, i, len(chunk_text.split())))

    cur.execute(sql.SQL("SELECT id, text_content FROM chunks WHERE processing_version_id = %s ORDER BY position ASC"), (processing_version_id,))
    chunks_for_processing = cur.fetchall()
    chunk_ids = [c[0] for c in chunks_for_processing]
    chunk_texts = [c[1] for c in chunks_for_processing]
    full_text = " ".join(chunk_texts)
    
    cur.execute(sql.SQL("SELECT example_text, example_label FROM classification_examples WHERE processing_version_id = %s"), (processing_version_id,))
    examples_from_db_tuples = cur.fetchall()
    classification_examples = [{"text": row[0], "label": row[1]} for row in examples_from_db_tuples]
    if classification_examples:
        print(f"Found {len(classification_examples)} few-shot examples for version_id {processing_version_id}.")

    embeddings = embedding_model.encode(chunk_texts)
    for i, chunk_id in enumerate(chunk_ids):
        cur.execute(sql.SQL("UPDATE chunks SET embedding = %s WHERE id = %s"), (embeddings[i].tolist(), chunk_id))

    topics = topic_extraction_pipeline.extract(chunk_texts, embeddings)
    for topic in topics:
        cur.execute(sql.SQL("INSERT INTO topics (id, processing_version_id, topic_text, weight, topic_type) VALUES (gen_random_uuid(), %s, %s, %s, %s)"), (processing_version_id, topic['topic_text'], topic['weight'], topic['topic_type']))

    summary = summarization_pipeline.summarize(full_text)
    cur.execute(sql.SQL("UPDATE processing_versions SET summary_text = %s, summary_type = %s, summary_confidence = %s WHERE id = %s"), (summary, "abstractive", 90, processing_version_id))

    action_items = action_item_extraction_pipeline.extract(full_text)
    for item in action_items:
        cur.execute(
            sql.SQL("""
                INSERT INTO action_items (id, processing_version_id, task_text, original_text, assignee_name, due_date, confidence, priority, dependencies)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s)
            """),
            (processing_version_id, item['task_text'], item['original_text'], item['assignee_name'], item['due_date'], item['confidence'], item['priority'], item['dependencies'])
        )
    
    entities, mentions, relationships = knowledge_graph_pipeline.extract_graph_components(chunks_for_processing)
    entity_id_map = {}
    for entity in entities:
        cur.execute(sql.SQL("INSERT INTO entities (id, name, entity_type) VALUES (gen_random_uuid(), %s, %s) ON CONFLICT (name, entity_type) DO UPDATE SET name=EXCLUDED.name RETURNING id"), (entity['name'], entity['type']))
        entity_id = cur.fetchone()[0]
        entity_id_map[(entity['name'], entity['type'])] = entity_id

    for mention in mentions:
        entity_key = (mention['entity_name'], mention['entity_type'])
        if entity_key in entity_id_map:
            cur.execute(sql.SQL("INSERT INTO entity_mentions (id, processing_version_id, chunk_id, entity_id, mentioned_text, confidence) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)"), (processing_version_id, mention['chunk_id'], entity_id_map[entity_key], int(mention['confidence'] * 100), mention['mentioned_text']))

    for rel in relationships:
        source_key = next((key for key in entity_id_map if key[0] == rel['source']), None)
        target_key = next((key for key in entity_id_map if key[0] == rel['target']), None)
        if source_key and target_key:
            cur.execute(sql.SQL("INSERT INTO relationships (id, processing_version_id, source_entity_id, target_entity_id, relationship_type, context_snippet) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)"), (processing_version_id, entity_id_map[source_key], entity_id_map[target_key], rel['type'], rel['context']))

    default_candidate_labels = ["finanças", "jurídico", "recursos humanos", "marketing", "relatório técnico", "confidencial"]
    classifications = classification_pipeline.classify(full_text, default_candidate_labels, examples=classification_examples)
    processed_labels = []
    for classification in classifications:
        if classification['confidence'] > 0.6:
            cur.execute(sql.SQL("INSERT INTO document_classifications (id, processing_version_id, label, confidence, classifier_type) VALUES (gen_random_uuid(), %s, %s, %s, %s) ON CONFLICT (processing_version_id, label) DO NOTHING"), (processing_version_id, classification['label'], int(classification['confidence'] * 100), classification['classifier_type']))
            processed_labels.append(classification['label'])
    
    if 'finanças' in processed_labels:
        financial_entities = finance_ner_pipeline.extract_financial_entities(full_text)
        print(f"Finance Flavor: Detected {len(financial_entities)} financial entities for version_id {processing_version_id}.")
        
        financial_kpis = finance_kpi_extractor_pipeline.extract_kpis(full_text)
        for kpi in financial_kpis:
            cur.execute(
                sql.SQL("INSERT INTO financial_kpis (id, processing_version_id, kpi_name, kpi_value, kpi_currency, period, source_snippet) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)"),
                (processing_version_id, kpi['kpi_name'], kpi['kpi_value'], kpi['kpi_currency'], kpi['period'], kpi['source_snippet'])
            )
        print(f"Finance Flavor: Extracted {len(financial_kpis)} KPIs for version_id {processing_version_id}.")

        risk_analysis = finance_risk_classifier_pipeline.classify_risk(full_text)
        cur.execute(
            sql.SQL("INSERT INTO financial_risk_analysis (id, processing_version_id, risk_level, confidence, summary, identified_clauses) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)"),
            (processing_version_id, risk_analysis['risk_level'], risk_analysis['confidence'], risk_analysis['summary'], Json(risk_analysis['identified_clauses']))
        )
        print(f"Finance Flavor: Performed risk analysis for version_id {processing_version_id}. Result: {risk_analysis['risk_level']}")

    cur.execute(sql.SQL("UPDATE processing_versions SET status = %s WHERE id = %s"), ('Processed_Text', processing_version_id))

def process_ingestion_job(document_id, processing_version_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql.SQL("SELECT file_name, mime_type, content FROM raw_files WHERE processing_version_id = %s"), (processing_version_id,))
        raw_file = cur.fetchone()
        if not raw_file:
            print(f"No raw file found for version_id: {processing_version_id}")
            return
        
        file_name, mime_type, content_bytes = raw_file
        
        is_tabular = file_name.endswith(('.csv', '.xlsx')) or 'spreadsheet' in mime_type or 'csv' in mime_type
        
        if is_tabular:
            result = tabular_processing_pipeline.process(content_bytes, file_name)
            if result:
                cur.execute(
                    sql.SQL("INSERT INTO tabular_data (id, processing_version_id, data_json, detected_schema, row_count, column_count) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)"),
                    (processing_version_id, Json(result['data_json']), Json(result['detected_schema']), result['row_count'], result['column_count'])
                )
                cur.execute(sql.SQL("UPDATE processing_versions SET status = %s WHERE id = %s"), ('Processed_Tabular', processing_version_id))
        else:
            text = ""
            if mime_type == 'text/x-url':
                url = content_bytes.decode('utf-8')
                text = extract_text_from_url(url)
            elif "pdf" in mime_type:
                text = extract_text_from_pdf(content_bytes)
            elif "openxmlformats-officedocument" in mime_type or "docx" in file_name:
                text = extract_text_from_docx(content_bytes)
            else:
                text = content_bytes.decode('utf-8', errors='ignore')
            
            process_unstructured_job(cur, document_id, processing_version_id, text)

        conn.commit()
        print(f"Successfully processed version_id: {processing_version_id} for document_id: {document_id}")
    except Exception as e:
        print(f"Error processing document_id {document_id} (version {processing_version_id}): {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def main():
    rabbitmq_host = os.environ.get('RABBITMQ_HOST', 'rabbitmq')
    connection_params = pika.ConnectionParameters(host=rabbitmq_host, connection_attempts=10, retry_delay=5)
    connection = pika.BlockingConnection(connection_params)
    channel = connection.channel()
    queue_name = 'ingestion_queue'
    channel.queue_declare(queue=queue_name, durable=True)

    def callback(ch, method, properties, body):
        try:
            message_data = json.loads(body.decode('utf-8'))
            document_id = message_data['document_id']
            processing_version_id = message_data['processing_version_id']
            print(f"Received job for version_id: {processing_version_id}")
            process_ingestion_job(document_id, processing_version_id)
        except Exception as e:
            print(f"Failed to decode message or process job: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    print('Worker started. Waiting for ingestion jobs.')
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Worker stopped.')
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)