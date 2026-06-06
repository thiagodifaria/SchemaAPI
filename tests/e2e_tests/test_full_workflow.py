# -*- coding: utf-8 -*-
import requests
import time
import os
from psycopg2 import sql

# Configurações do teste
API_URL = os.environ.get("API_URL", "http://localhost:8081")
POLL_TIMEOUT_SECONDS = 90
POLL_INTERVAL_SECONDS = 2
TEST_FILE_PATH = "tests/e2e_tests/sample_document.txt"
TEST_FILE_CONTENT = """
Relatório Financeiro e de Planejamento - Q3 2025

Discussão sobre os resultados financeiros. A Receita Líquida foi de R$ 500.000, um aumento de 15%.
O time de marketing, liderado por Maria Clara, apresentou a nova campanha.
Ficou decidido que Maria precisa enviar o plano de mídia consolidado para aprovação até a próxima sexta-feira.
Thiago Di Faria ficou responsável por alinhar o novo orçamento com a diretoria.
"""

def poll_for_status(document_id: str, expected_status: str = "Processed_Text") -> dict:
    start_time = time.time()
    while time.time() - start_time < POLL_TIMEOUT_SECONDS:
        res = requests.get(f"{API_URL}/documents/{document_id}")
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == expected_status:
                return data
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError(f"O documento {document_id} não atingiu o status '{expected_status}' dentro de {POLL_TIMEOUT_SECONDS} segundos.")

def test_full_e2e_workflow(db_connection):
    # Setup Inicial
    with open(TEST_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(TEST_FILE_CONTENT)

    # Upload do arquivo
    with open(TEST_FILE_PATH, "rb") as f:
        files = {'file': (os.path.basename(TEST_FILE_PATH), f, 'text/plain')}
        res = requests.post(f"{API_URL}/documents/upload", files=files)
    
    assert res.status_code == 202
    data = res.json()
    document_id = data.get("document_id")
    assert document_id is not None

    # Polling e verificação da API
    processed_data = poll_for_status(document_id)
    
    # Verifica resumo
    assert "summary_text" in processed_data
    assert len(processed_data["summary_text"]) > 10

    # Verifica item de ação
    assert "action_items" in processed_data
    action_items = processed_data["action_items"]
    assert len(action_items) >= 1
    maria_task = next((item for item in action_items if "Maria" in item.get("assignee_name", "")), None)
    assert maria_task is not None
    assert maria_task.get("due_date") is not None # Verifica se a data foi extraída

    # Verifica grafo de conhecimento
    res_graph = requests.get(f"{API_URL}/documents/{document_id}/graph")
    assert res_graph.status_code == 200
    graph_data = res_graph.json()
    node_labels = [node['label'] for node in graph_data['nodes']]
    assert any("Maria" in label for label in node_labels)

    # Verificação direta no banco de dados
    cur = db_connection.cursor()
    
    try:
        # Encontra o ID da versão mais recente
        cur.execute(sql.SQL("SELECT id FROM processing_versions WHERE document_id = %s ORDER BY version_number DESC LIMIT 1"), (document_id,))
        version_result = cur.fetchone()
        assert version_result is not None, f"Nenhuma versão encontrada para document_id: {document_id}"
        version_id = version_result[0]
        
        # Verifica classificação
        cur.execute(sql.SQL("SELECT label FROM document_classifications WHERE processing_version_id = %s"), (version_id,))
        labels = [row[0] for row in cur.fetchall()]
        assert "finanças" in labels
        
        # Verifica KPI Financeiro
        cur.execute(sql.SQL("SELECT kpi_name, kpi_value FROM financial_kpis WHERE processing_version_id = %s"), (version_id,))
        kpi = cur.fetchone()
        assert kpi is not None
        assert kpi[0] == "Receita"
        assert int(kpi[1]) == 500000
        
    finally:
        cur.close()

    # Verificação da busca
    search_payload = {"query": "orçamento com a diretoria"}
    res_search = requests.post(f"{API_URL}/search", json=search_payload)
    assert res_search.status_code == 200
    search_results = res_search.json()
    assert len(search_results) > 0
    assert search_results[0]['document_id'] == document_id

    res_hybrid = requests.post(f"{API_URL}/search/hybrid", json=search_payload)
    assert res_hybrid.status_code == 200
    assert len(res_hybrid.json()) > 0

    res_rag = requests.post(f"{API_URL}/rag/query", json={"query": "Quem ficou responsável pelo orçamento?"})
    assert res_rag.status_code == 200
    rag_data = res_rag.json()
    assert "answer" in rag_data
    assert "citations" in rag_data

    res_redact = requests.post(
        f"{API_URL}/governance/pii/redact",
        json={"text": "Contato maria@example.com CPF 123.456.789-00"}
    )
    assert res_redact.status_code == 200
    assert "REDACTED" in res_redact.json()["redacted_text"]

    res_eval = requests.post(f"{API_URL}/observability/rag/evaluate")
    assert res_eval.status_code in (200, 404)

    res_tools = requests.get(f"{API_URL}/agents/tools")
    assert res_tools.status_code == 200
    assert len(res_tools.json()) >= 1

    res_agent = requests.post(
        f"{API_URL}/agents/runs",
        json={"goal": "Verificar discrepância documental", "requested_tool": "compare_invoice_purchase_order"}
    )
    assert res_agent.status_code == 202
    agent_run = res_agent.json()
    assert agent_run["status"] == "waiting_approval"

    res_approve = requests.post(
        f"{API_URL}/agents/runs/{agent_run['id']}/approve",
        json={"approved_by": "qa"}
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "executed"

    res_multimodal = requests.get(f"{API_URL}/documents/{document_id}/multimodal")
    assert res_multimodal.status_code == 200

    # Cleanup
    if os.path.exists(TEST_FILE_PATH):
        os.remove(TEST_FILE_PATH)
