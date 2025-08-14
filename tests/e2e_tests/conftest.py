import pytest
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(
    dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'),
    override=True,
    encoding='utf-8'
)

@pytest.fixture(scope="module")
def db_connection():
    """
    Cria e fornece uma conexão com o banco de dados PostgreSQL do Docker.
    A conexão é fechada automaticamente no final do módulo de testes.
    """
    try:
        db_name = os.environ.get("POSTGRES_DB", "schema_api_db")
        db_user = os.environ.get("POSTGRES_USER", "admin")
        db_password = os.environ.get("POSTGRES_PASSWORD", "password123")
        
        connection_params = {
            'dbname': db_name,
            'user': db_user,
            'password': db_password,
            'host': 'localhost',
            'port': '5432',
            'client_encoding': 'UTF8',
            'options': '-c client_encoding=UTF8'
        }
        
        conn = psycopg2.connect(**connection_params)
        
        conn.set_client_encoding('UTF8')
        
        yield conn
        conn.close()
    except psycopg2.OperationalError as e:
        pytest.fail(f"Não foi possível conectar ao banco de dados PostgreSQL. O ambiente Docker está rodando? Erro: {e}")
    except UnicodeDecodeError as e:
        pytest.fail(f"Erro de encoding ao conectar com o banco de dados. Verifique se o arquivo .env está salvo em UTF-8. Erro: {e}")