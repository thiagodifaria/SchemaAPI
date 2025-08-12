import pytest
import psycopg2
import os

@pytest.fixture(scope="module")
def db_connection():
    """
    Cria e fornece uma conexão com o banco de dados PostgreSQL do Docker.
    A conexão é fechada automaticamente no final do módulo de testes.
    """
    try:
        conn = psycopg2.connect(
            dbname=os.environ.get("POSTGRES_DB", "schema_api_db"),
            user=os.environ.get("POSTGRES_USER", "admin"),
            password=os.environ.get("POSTGRES_PASSWORD", "password123"),
            host="localhost", # Conectando do host para o container exposto
            port="5432"
        )
        yield conn
        conn.close()
    except psycopg2.OperationalError as e:
        pytest.fail(f"Não foi possível conectar ao banco de dados PostgreSQL. O ambiente Docker está rodando? Erro: {e}")