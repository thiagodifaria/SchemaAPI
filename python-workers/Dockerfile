FROM python:3.11-slim

WORKDIR /usr/src/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN python -c "from transformers import pipeline; pipeline('summarization', model='Falconsai/text_summarization')"
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
RUN python -c "from transformers import pipeline; pipeline('ner', model='dslim/bert-base-NER')"
RUN python -c "from transformers import pipeline; pipeline('zero-shot-classification', model='facebook/bart-large-mnli')"
RUN python -c "from transformers import pipeline; pipeline('ner', model='Jean-Baptiste/roberta-large-ner-english')"

COPY ./src .

CMD ["python", "src/worker.py"]