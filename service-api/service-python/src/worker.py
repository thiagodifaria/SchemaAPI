import json
import os
import re
import sys
import socket
import time

import pika
import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json
from sentence_transformers import SentenceTransformer

from chunk import semantic_chunk
from metrics import extract_financial_facts, facts_to_briefing
from parse import ParsedDocument, parse_docx, parse_pdf, parse_text, parse_url
from extract.action import action_extractor
from extract.clause import clause_extractor
from extract.graph import graph_extractor
from extract.kpi import kpi_extractor
from extract.table import table_processor
from extract.topic import topic_extractor
from learn.active import active_learning
from model.classify import classifier
from model.risk import risk_classifier
from model.summary import summarizer
from template.apply import template_apply
from template.detect import template_detect


embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


def db_float(value, default=0.0) -> float:
    if value is None:
        return default
    return float(value)


def add_rule_based_classifications(text: str, classifications: list[dict]) -> list[dict]:
    lower_text = text.lower()
    finance_terms = ("receita", "orçamento", "orcamento", "financeiro", "kpi", "faturamento", "nota fiscal")
    if any(term in lower_text for term in finance_terms):
        finance_item = next((item for item in classifications if item["label"] == "finanças"), None)
        if finance_item:
            finance_item["confidence"] = max(db_float(finance_item["confidence"]), 0.92)
            finance_item["classifier_type"] = f"{finance_item['classifier_type']}+rule"
        else:
            classifications.append({
                "label": "finanças",
                "confidence": 0.92,
                "classifier_type": "rule-based",
            })
    return classifications


def detect_pii(text: str) -> tuple[str, list[dict]]:
    patterns = [
        ("cpf", r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
        ("cnpj", r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b"),
        ("email", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        ("phone", r"(?<!\d)(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}(?!\d)"),
        ("credit_card", r"\b(?:\d[ -]*?){13,16}\b"),
    ]
    findings = []
    redacted = text
    for pii_type, pattern in patterns:
        for match in re.finditer(pattern, text):
            findings.append({
                "type": pii_type,
                "start": match.start(),
                "end": match.end(),
                "sample": match.group(0)[:4] + "***",
            })
        redacted = re.sub(pattern, f"[REDACTED_{pii_type.upper()}]", redacted)
    return redacted, findings


def insert_chunks(cur, processing_version_id, chunks: list[dict]):
    for position, chunk in enumerate(chunks):
        contextual_text = chunk["text"]
        clean_text = chunk.get("clean_text") or contextual_text
        redacted_text, pii_findings = detect_pii(clean_text)
        layout = {
            "section_title": chunk.get("section_title"),
            "page_number": chunk.get("page_number"),
            "content_type": chunk.get("content_type", "text"),
            **chunk.get("metadata", {}),
        }

        # The contextual text is indexed and embedded; clean/raw variants stay
        # available for product display, audit and future reprocessing.
        cur.execute(
            sql.SQL("""
                INSERT INTO chunks (
                    id, processing_version_id, text_content, position, token_count,
                    section_title, content_type, page_number, metadata, pii_redacted_text,
                    pii_findings, raw_text_content, normalized_text_content, contextual_text,
                    context_summary, layout_metadata
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """),
            (
                processing_version_id,
                contextual_text,
                position,
                len(clean_text.split()),
                chunk.get("section_title"),
                chunk.get("content_type", "text"),
                chunk.get("page_number"),
                Json(chunk.get("metadata", {})),
                redacted_text if pii_findings else None,
                Json(pii_findings),
                chunk.get("raw_text"),
                clean_text,
                contextual_text,
                chunk.get("context"),
                Json(layout),
            ),
        )


def insert_multimodal_blocks(cur, processing_version_id, blocks: list[dict]):
    for position, block in enumerate(blocks):
        cur.execute(
            sql.SQL("""
                INSERT INTO multimodal_blocks (
                    id, processing_version_id, block_type, page_number, position, content_text, metadata
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
            """),
            (
                processing_version_id,
                block["block_type"],
                block.get("page_number"),
                position,
                block.get("content_text"),
                Json(block.get("metadata", {})),
            ),
        )


def insert_tabular_data(cur, processing_version_id, result: dict):
    cur.execute(
        sql.SQL("""
            INSERT INTO tabular_data (id, processing_version_id, data_json, detected_schema, row_count, column_count)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
        """),
        (
            processing_version_id,
            Json(result["data_json"]),
            Json(result["detected_schema"]),
            result["row_count"],
            result["column_count"],
        ),
    )


def get_db_connection():
    return psycopg2.connect(
        dbname=os.environ.get("POSTGRES_DB"),
        user=os.environ.get("POSTGRES_USER"),
        password=os.environ.get("POSTGRES_PASSWORD"),
        host=os.environ.get("DB_HOST"),
        port=os.environ.get("DB_PORT", "5432"),
    )


def run_document_processors(cur, document_id, processing_version_id, full_text, chunk_texts, chunks_for_processing, financial_facts=None):
    conn = cur.connection
    # Chunk IDs are generated by Postgres first; embeddings are written back after
    # that so every vector can be traced to the exact persisted chunk and version.
    embeddings = embedding_model.encode(chunk_texts)
    for index, (chunk_id, _) in enumerate(chunks_for_processing):
        cur.execute(sql.SQL("UPDATE chunks SET embedding = %s WHERE id = %s"), (embeddings[index].tolist(), chunk_id))

    topics = topic_extractor.extract(chunk_texts, embeddings)
    for topic in topics:
        cur.execute(
            sql.SQL("INSERT INTO topics (id, processing_version_id, topic_text, weight, topic_type) VALUES (gen_random_uuid(), %s, %s, %s, %s)"),
            (processing_version_id, topic["topic_text"], db_float(topic["weight"]), topic["topic_type"]),
        )

    summary = facts_to_briefing(financial_facts or []) or summarizer.summarize(full_text)
    cur.execute(
        sql.SQL("UPDATE processing_versions SET summary_text = %s, summary_type = %s, summary_confidence = %s WHERE id = %s"),
        (summary, "structured_briefing", 92 if financial_facts else 85, processing_version_id),
    )

    action_items = action_extractor.extract(full_text)
    for item in action_items:
        cur.execute(
            sql.SQL("""
                INSERT INTO action_items (
                    id, processing_version_id, task_text, original_text, assignee_name,
                    due_date, confidence, priority, dependencies
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s)
            """),
            (
                processing_version_id,
                item["task_text"],
                item["original_text"],
                item["assignee_name"],
                item["due_date"],
                item["confidence"],
                item["priority"],
                item["dependencies"],
            ),
        )

    entities, mentions, relationships = graph_extractor.extract_graph_components(chunks_for_processing)
    entity_id_map = {}
    for entity in entities:
        cur.execute(
            sql.SQL("""
                INSERT INTO entities (id, name, entity_type)
                VALUES (gen_random_uuid(), %s, %s)
                ON CONFLICT (name, entity_type) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            """),
            (entity["name"], entity["type"]),
        )
        entity_id = cur.fetchone()[0]
        entity_id_map[(entity["name"], entity["type"])] = entity_id

    for mention in mentions:
        entity_key = (mention["entity_name"], mention["entity_type"])
        if entity_key in entity_id_map:
            cur.execute(
                sql.SQL("""
                    INSERT INTO entity_mentions (
                        id, processing_version_id, chunk_id, entity_id, mentioned_text, confidence
                    )
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
                """),
                (
                    processing_version_id,
                    mention["chunk_id"],
                    entity_id_map[entity_key],
                    mention["mentioned_text"],
                    db_float(mention["confidence"]),
                ),
            )

    for rel in relationships:
        source_key = next((key for key in entity_id_map if key[0] == rel["source"]), None)
        target_key = next((key for key in entity_id_map if key[0] == rel["target"]), None)
        if source_key and target_key:
            cur.execute(
                sql.SQL("""
                    INSERT INTO relationships (
                        id, processing_version_id, source_entity_id, target_entity_id,
                        relationship_type, context_snippet
                    )
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
                """),
                (
                    processing_version_id,
                    entity_id_map[source_key],
                    entity_id_map[target_key],
                    rel["type"],
                    rel["context"],
                ),
            )

    cur.execute(sql.SQL("SELECT example_text, example_label FROM classification_examples WHERE processing_version_id = %s"), (processing_version_id,))
    examples_from_db = cur.fetchall()
    classification_examples = [{"text": row[0], "label": row[1]} for row in examples_from_db]

    default_candidate_labels = ["finanças", "jurídico", "recursos humanos", "marketing", "relatório técnico", "confidencial"]
    classifications = classifier.classify(full_text, default_candidate_labels, examples=classification_examples)
    classifications = add_rule_based_classifications(full_text, classifications)
    processed_labels = []
    for classification in classifications:
        if db_float(classification["confidence"]) > 0.6:
            cur.execute(
                sql.SQL("""
                    INSERT INTO document_classifications (id, processing_version_id, label, confidence, classifier_type)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s)
                    ON CONFLICT (processing_version_id, label) DO NOTHING
                """),
                (
                    processing_version_id,
                    classification["label"],
                    int(db_float(classification["confidence"]) * 100),
                    classification["classifier_type"],
                ),
            )
            processed_labels.append(classification["label"])

    # Domain flavors are intentionally gated by classification confidence to avoid
    # running finance/legal extractors on generic documents and polluting analytics.
    if "finanças" in processed_labels:
        financial_kpis = kpi_extractor.extract_kpis(full_text)
        for fact in financial_facts or []:
            financial_kpis.append({
                "kpi_name": fact["metric"],
                "kpi_value": fact["current_value"],
                "kpi_currency": "BRL",
                "period": None,
                "source_snippet": fact["source_snippet"],
            })
        for kpi in financial_kpis:
            cur.execute(
                sql.SQL("""
                    INSERT INTO financial_kpis (
                        id, processing_version_id, kpi_name, kpi_value, kpi_currency, period, source_snippet
                    )
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
                """),
                (
                    processing_version_id,
                    kpi["kpi_name"],
                    kpi["kpi_value"],
                    kpi["kpi_currency"],
                    kpi["period"],
                    kpi["source_snippet"],
                ),
            )
        risk_analysis = risk_classifier.classify_risk(full_text)
        cur.execute(
            sql.SQL("""
                INSERT INTO financial_risk_analysis (
                    id, processing_version_id, risk_level, confidence, summary, identified_clauses
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
            """),
            (
                processing_version_id,
                risk_analysis["risk_level"],
                db_float(risk_analysis["confidence"]),
                risk_analysis["summary"],
                Json(risk_analysis["identified_clauses"]),
            ),
        )
        print(f"Finance Flavor: extracted {len(financial_kpis)} KPIs for version_id {processing_version_id}.")
    elif "jurídico" in processed_labels:
        legal_clauses = clause_extractor.extract_clauses(full_text)
        for clause in legal_clauses:
            cur.execute(
                sql.SQL("""
                    INSERT INTO legal_clauses (id, processing_version_id, clause_type, clause_text, confidence)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s)
                """),
                (
                    processing_version_id,
                    clause["clause_type"],
                    clause["clause_text"],
                    db_float(clause["confidence"]),
                ),
            )
        print(f"Legal Flavor: extracted {len(legal_clauses)} clauses for version_id {processing_version_id}.")

    # Low-confidence predictions become review tasks instead of silently hardening
    # weak labels into the dataset.
    items_for_review = active_learning.uncertainty_sampling(conn, processing_version_id)
    for item in items_for_review:
        cur.execute(
            sql.SQL("""
                INSERT INTO review_queue (id, processing_version_id, prediction_id, prediction_type, reason, priority)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
            """),
            (
                processing_version_id,
                item["prediction_id"],
                item["prediction_type"],
                item["reason"],
                item["priority"],
            ),
        )
    if items_for_review:
        print(f"Active Learning: added {len(items_for_review)} review items for version_id {processing_version_id}.")


def process_parsed_job(cur, document_id, processing_version_id, parsed: ParsedDocument, status="Processed_Text"):
    normalized_text = re.sub(r"\s+", " ", parsed.clean_text).lower()
    generated_markers = [
        "relatorio executivo gerado",
        "relatório executivo gerado",
        "schema api - pagina",
        "schema api pagina",
        "sintese por pergunta rag",
        "síntese por pergunta rag",
        "sintese por busca hibrida",
        "síntese por busca híbrida",
        "revise as fontes antes de uso externo",
    ]
    if sum(1 for marker in generated_markers if marker in normalized_text) >= 2:
        cur.execute(
            sql.SQL("UPDATE processing_versions SET status = %s, summary_text = %s WHERE id = %s"),
            (
                "Rejected_GeneratedArtifact",
                "Arquivo rejeitado: relatorios exportados pela Schema API nao devem ser reindexados como fonte.",
                processing_version_id,
            ),
        )
        print(f"Rejected generated Schema API artifact for version_id {processing_version_id}.")
        return

    if parsed.multimodal_blocks:
        insert_multimodal_blocks(cur, processing_version_id, parsed.multimodal_blocks)

    structure_info = template_detect.extract_features(parsed.clean_text)
    structure_info["features"]["parser"] = parsed.features
    structure_hash = structure_info["structure_hash"]
    cur.execute(
        sql.SQL("INSERT INTO document_structures (id, processing_version_id, features, structure_hash) VALUES (gen_random_uuid(), %s, %s, %s)"),
        (processing_version_id, Json(structure_info["features"]), structure_hash),
    )

    cur.execute(sql.SQL("SELECT structure_definition FROM document_templates WHERE structure_hash = %s"), (structure_hash,))
    template_row = cur.fetchone()
    if template_row:
        print(f"Matching template found for version_id {processing_version_id}. Applying template-based parsing.")
        template_apply.apply_template(parsed.clean_text, template_row[0])
    else:
        print(f"No matching template found for version_id {processing_version_id}. Using contextual semantic processing.")

    chunks = semantic_chunk(parsed.blocks)
    if not chunks:
        cur.execute(sql.SQL("UPDATE processing_versions SET status = %s WHERE id = %s"), ("Failed_NoContent", processing_version_id))
        return

    insert_chunks(cur, processing_version_id, chunks)
    financial_facts = extract_financial_facts(parsed.clean_text)

    cur.execute(sql.SQL("SELECT id, text_content FROM chunks WHERE processing_version_id = %s ORDER BY position ASC"), (processing_version_id,))
    chunks_for_processing = cur.fetchall()
    chunk_texts = [chunk[1] for chunk in chunks_for_processing]
    run_document_processors(cur, document_id, processing_version_id, parsed.clean_text, chunk_texts, chunks_for_processing, financial_facts)

    cur.execute(sql.SQL("UPDATE processing_versions SET status = %s WHERE id = %s"), (status, processing_version_id))


def parse_raw_file(file_name: str, mime_type: str, content_bytes: bytes) -> ParsedDocument:
    if mime_type == "text/x-url":
        return parse_url(content_bytes.decode("utf-8"))
    if "pdf" in mime_type:
        return parse_pdf(content_bytes)
    if "openxmlformats-officedocument" in mime_type or file_name.endswith(".docx"):
        return parse_docx(content_bytes)
    return parse_text(content_bytes, source=file_name)


def process_tabular_job(cur, document_id, processing_version_id, file_name: str, content_bytes: bytes):
    result = table_processor.process(content_bytes, file_name)
    if not result:
        cur.execute(sql.SQL("UPDATE processing_versions SET status = %s WHERE id = %s"), ("Failed_NoContent", processing_version_id))
        return

    insert_tabular_data(cur, processing_version_id, result)
    table_text = json.dumps({
        "schema": result["detected_schema"],
        "rows": result["data_json"][:100],
        "summary_stats": result["summary_stats"],
        "anomalies": result["anomalies"],
    }, ensure_ascii=False)
    parsed = parse_text(table_text, source=file_name)
    parsed.features["table_count"] = 1
    parsed.features["row_count"] = result["row_count"]
    parsed.features["column_count"] = result["column_count"]
    parsed.multimodal_blocks.append({
        "block_type": "table",
        "page_number": None,
        "content_text": table_text,
        "metadata": {
            "row_count": result["row_count"],
            "column_count": result["column_count"],
            "source": file_name,
            "schema": result["detected_schema"],
        },
    })
    process_parsed_job(cur, document_id, processing_version_id, parsed, status="Processed_Tabular")


def process_ingestion_job(document_id, processing_version_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql.SQL("SELECT status FROM processing_versions WHERE id = %s"), (processing_version_id,))
        status_row = cur.fetchone()
        if status_row and status_row[0] in ("Processed_Text", "Processed_Tabular"):
            print(f"Skipping already processed version_id: {processing_version_id}")
            conn.commit()
            return

        cur.execute(sql.SQL("SELECT file_name, mime_type, content FROM raw_files WHERE processing_version_id = %s"), (processing_version_id,))
        raw_file = cur.fetchone()
        if not raw_file:
            print(f"No raw file found for version_id: {processing_version_id}")
            return

        file_name, mime_type, content_bytes = raw_file
        content_bytes = bytes(content_bytes)
        is_tabular = file_name.endswith((".csv", ".xlsx")) or "spreadsheet" in mime_type or "csv" in mime_type

        if is_tabular:
            process_tabular_job(cur, document_id, processing_version_id, file_name, content_bytes)
        else:
            parsed = parse_raw_file(file_name, mime_type, content_bytes)
            process_parsed_job(cur, document_id, processing_version_id, parsed)

        conn.commit()
        print(f"Successfully processed version_id: {processing_version_id} for document_id: {document_id}")
    except Exception as error:
        print(f"Error processing document_id {document_id} (version {processing_version_id}): {error}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


def claim_postgres_job(worker_id: str):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            sql.SQL("""
                SELECT id, document_id, processing_version_id
                FROM desktop_ingestion_jobs
                WHERE status = 'pending'
                   OR (status = 'running' AND locked_at < NOW() - INTERVAL '30 minutes')
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            """)
        )
        row = cur.fetchone()
        if not row:
            conn.commit()
            return None

        job_id, document_id, processing_version_id = row
        cur.execute(
            sql.SQL("""
                UPDATE desktop_ingestion_jobs
                SET status = 'running',
                    attempts = attempts + 1,
                    locked_at = NOW(),
                    locked_by = %s,
                    updated_at = NOW()
                WHERE id = %s
            """),
            (worker_id, job_id),
        )
        conn.commit()
        return {
            "job_id": str(job_id),
            "document_id": str(document_id),
            "processing_version_id": str(processing_version_id),
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def complete_postgres_job(job_id: str, status: str, error: str | None = None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            sql.SQL("""
                UPDATE desktop_ingestion_jobs
                SET status = %s,
                    last_error = %s,
                    locked_at = NULL,
                    updated_at = NOW()
                WHERE id = %s
            """),
            (status, error, job_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def run_postgres_worker():
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    poll_seconds = float(os.environ.get("POSTGRES_JOB_POLL_SECONDS", "2"))
    print(f"Worker started with PostgreSQL desktop queue as {worker_id}.")
    while True:
        job = claim_postgres_job(worker_id)
        if not job:
            time.sleep(poll_seconds)
            continue

        job_id = job["job_id"]
        document_id = job["document_id"]
        processing_version_id = job["processing_version_id"]
        try:
            print(f"Claimed desktop job {job_id} for version_id: {processing_version_id}")
            process_ingestion_job(document_id, processing_version_id)
            complete_postgres_job(job_id, "completed")
        except Exception as error:
            print(f"Failed desktop job {job_id}: {error}")
            complete_postgres_job(job_id, "failed", str(error))


def run_rabbitmq_worker():
    rabbitmq_host = os.environ.get("RABBITMQ_HOST", "rabbitmq")
    connection_params = pika.ConnectionParameters(
        host=rabbitmq_host,
        connection_attempts=10,
        retry_delay=5,
        heartbeat=0,
        blocked_connection_timeout=1800,
    )
    connection = pika.BlockingConnection(connection_params)
    channel = connection.channel()
    queue_name = "ingestion_queue"
    channel.queue_declare(queue=queue_name, durable=True)

    def callback(ch, method, properties, body):
        try:
            message_data = json.loads(body.decode("utf-8"))
            document_id = message_data["document_id"]
            processing_version_id = message_data["processing_version_id"]
            print(f"Received job for version_id: {processing_version_id}")
            process_ingestion_job(document_id, processing_version_id)
        except Exception as error:
            print(f"Failed to decode message or process job: {error}")
        try:
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as error:
            print(f"Failed to ack ingestion message: {error}")

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    print("Worker started. Waiting for ingestion jobs.")
    channel.start_consuming()


def main():
    queue_backend = os.environ.get("WORKER_QUEUE_BACKEND", os.environ.get("SCHEMA_QUEUE_BACKEND", "rabbitmq")).lower()
    if queue_backend in ("postgres", "postgres_jobs", "desktop"):
        run_postgres_worker()
    else:
        run_rabbitmq_worker()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Worker stopped.")
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)
