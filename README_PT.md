# SchemaAPI - Plataforma de Inteligencia Documental

SchemaAPI e uma plataforma local de inteligencia documental para ingestao, extracao estruturada, busca hibrida, RAG com citacoes, GraphRAG leve, governanca, observabilidade e operacao por aplicativo desktop.

O projeto foi organizado como uma aplicacao orientada a servicos. O cliente desktop fica em `client-desktop`, as capacidades de backend ficam em `service-api`, as migrations ficam em `service-api/service-postgresql`, a infraestrutura fica em `infra`, os comandos operacionais ficam em `scripts` e a documentacao tecnica fica em `docs`.

A aplicacao roda localmente com Docker Compose. O backend usa uma API Rust com Actix, workers Python para processamento documental, PostgreSQL com pgvector para persistencia e busca vetorial, RabbitMQ para eventos de processamento e uma aplicacao Electron/React para controle operacional.

## Estrutura do Repositorio

```text
client-desktop/
  electron/
  src/
  package.json

service-api/
  service-rust/
    src/api/
    src/domain/
    src/infrastructure/
  service-python/
    src/extract/
    src/learn/
    src/model/
    src/template/
    src/worker.py
    src/server.py
  service-postgresql/
    migrations/

infra/
  docker-compose.yml

scripts/
tests/
docs/
```

## Funcionalidades

- Upload de documentos e ingestao por URL.
- Processamento assincrono de documentos por RabbitMQ.
- Suporte a PDF, DOCX, texto, CSV e planilhas pelos caminhos implementados no worker Python.
- Parsing de documentos com blocos textuais, secoes, tabelas, imagens detectadas e metadados de layout.
- Chunking semantico contextual com preservacao de texto bruto, texto limpo e contexto de busca.
- Embeddings com `all-MiniLM-L6-v2` e armazenamento em pgvector.
- Busca vetorial, busca lexical por PostgreSQL full-text search e busca hibrida.
- Respostas RAG com citacoes, auditoria e avisos quando a fonte original nao esta disponivel.
- Grafo leve com entidades, mencoes e relacoes extraidas dos chunks.
- Extracao de resumo, topicos, classificacoes, itens de acao, KPIs financeiros, riscos, clausulas legais e dados tabulares.
- Registro de blocos multimodais/layout para tabelas, imagens e secoes detectadas.
- Redacao local de PII e trilha de auditoria.
- Avaliacoes deterministicas de RAG para observabilidade.
- Execucoes agentivas controladas com fluxo de aprovacao.
- Relatorios de analise gerados pela API e exportaveis pelo endpoint de analise.
- Aplicacao desktop para documentos, dashboard, busca hibrida, RAG, analise, governanca, agentes e observabilidade.

## Superficies da Aplicacao

O SchemaAPI expoe o motor documental por tres superficies praticas:

- A API Rust em `service-api/service-rust`, responsavel por upload, consulta, busca, RAG, governanca, agentes, analise e acesso ao PostgreSQL.
- Os processos Python em `service-api/service-python`, responsaveis por parsing, chunking, embeddings, extracoes, analise assincroma e API de vetorizacao.
- O control plane desktop em `client-desktop`, usado para operar o backend local sem depender de chamadas manuais por terminal.

Essa separacao mantem a API como fronteira publica, deixa o processamento pesado no worker Python e concentra a experiencia operacional no desktop.

## Pipeline Documental

O fluxo principal de dados e:

1. A API recebe um arquivo em `/documents/upload` ou uma URL em `/documents/url`.
2. A API grava metadados, arquivo bruto e uma versao de processamento no PostgreSQL.
3. A API publica o trabalho no RabbitMQ.
4. O worker Python recupera o arquivo bruto, escolhe o parser adequado e monta blocos estruturados.
5. O worker rejeita artefatos gerados pelo proprio SchemaAPI quando eles aparecem como fonte de ingestao, para evitar reindexacao de relatorios exportados.
6. O chunker gera chunks contextuais e salva metadados de secao, pagina, tipo de conteudo e layout.
7. O worker calcula embeddings, extrai topicos, classificacoes, itens de acao, grafo, KPIs, riscos e tabelas.
8. A API consulta as tabelas persistidas para documentos, busca, RAG, grafo, analise e observabilidade.

## Retrieval e RAG

A busca semantica usa embeddings armazenados na coluna pgvector dos chunks. A busca lexical usa `tsvector` em PostgreSQL. A busca hibrida combina sinais semanticos e lexicais, aplica apresentacao orientada a evidencias e retorna avisos quando a API precisa explicar uma ausencia de fonte original.

O endpoint `/rag/query` recupera contexto, aplica filtros de role quando informados e monta uma resposta com citacoes. Quando a evidencia recuperada nao sustenta a pergunta, a resposta deve preferir declarar insuficiencia de evidencia em vez de completar lacunas.

GraphRAG nesta fase e leve: o sistema usa entidades, mencoes e relacoes extraidas para enriquecer contexto, sem prometer raciocinio grafico profundo ou inferencia externa.

## Governanca, Agentes e Observabilidade

O modulo de governanca inclui redacao local de PII por padroes, metadados de acesso nos chunks e consulta de eventos de auditoria. O runtime agentivo exposto pela API trabalha com ferramentas registradas, classifica risco operacional e exige aprovacao para execucoes sensiveis.

A observabilidade de RAG registra consultas auditadas e avaliacoes deterministicas com metricas internas como fidelidade, precisao de contexto, alinhamento da resposta e aderencia a fontes. Esses valores sao leituras operacionais do proprio avaliador, nao benchmarks externos.

## Desktop

O desktop fica em `client-desktop` e usa Electron, React, Vite e TypeScript. Ele conversa com a API local em `http://localhost:8081` e oferece telas para:

1. Dashboard de saude, documentos e evidencias.
2. Documentos da sessao e inspetor de processamento.
3. Busca hibrida.
4. RAG.
5. Relatorios de analise.
6. Governanca.
7. Agentes.
8. Observabilidade.

## Instalacao e Execucao

O caminho recomendado e Docker-first:

```bash
./scripts/build.sh
```

Para reconstruir sem abrir a janela desktop:

```bash
./scripts/build.sh --no-desktop
```

Para preservar dados do PostgreSQL:

```bash
./scripts/build.sh --keep-data
```

Servicos locais:

- API Rust: `http://localhost:8081`
- API Python de vetorizacao: `http://localhost:8001`
- RabbitMQ UI: `http://localhost:15672`
- PostgreSQL: `localhost:5432`

## Configuracao

Crie ou ajuste `.env` na raiz do repositorio. Os valores locais padrao ficam em `.env.example`.

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=schema_api_db

DATABASE__URL=postgres://admin:password123@postgres:5432/schema_api_db
RABBITMQ__URL=amqp://guest:guest@rabbitmq:5672/%2f
API__HOST=0.0.0.0
API__PORT=8081
```

## Testes e Validacao

O fluxo de smoke/e2e sobe a stack Docker, aguarda a API, instala dependencias de teste em container Python e executa `tests/e2e_tests`.

```bash
./scripts/test.sh smoke
```

Validacoes menores:

```bash
./scripts/build.sh contracts
./scripts/test.sh contract
./scripts/test.sh desktop
```

## Screenshots

### Dashboard

![Dashboard](docs/assets/images/dashboard.png)

### RAG

![RAG](docs/assets/images/rag.png)

### Analise

![Analise](docs/assets/images/analise.png)

## Build e Execucao Local

Este repositorio deve ser compilado e executado localmente com Docker Compose por meio dos scripts do projeto. Use `./scripts/build.sh` para subir a stack completa com o desktop, ou `./scripts/build.sh --no-desktop` para reconstruir apenas os servicos de backend.

## Limites Operacionais

O SchemaAPI e uma plataforma local de inteligencia documental e apoio operacional. Ele nao substitui revisao humana, nao garante completude de evidencias em documentos incompletos e nao deve indexar relatorios exportados pelo proprio SchemaAPI como fonte primaria. Respostas RAG precisam ser avaliadas contra as citacoes retornadas.

## Licenca

Este projeto esta licenciado sob a licenca MIT. Veja [LICENSE](LICENSE).

## Contato

Thiago Di Faria - [thiagodifaria@gmail.com](mailto:thiagodifaria@gmail.com)

Link do projeto: [https://github.com/thiagodifaria/SchemaAPI](https://github.com/thiagodifaria/SchemaAPI)
