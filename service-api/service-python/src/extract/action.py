from transformers import pipeline
import re
import dateparser
from dateparser.search import search_dates

class ActionExtractor:
    def __init__(self):
        self.ner_model = None
        self.priority_keywords = {
            "high": ['urgente', 'imediato', 'crítico', 'prazo final', 'asap', 'urgent', 'critical'],
            "low": ['se houver tempo', 'quando possível', 'baixa prioridade', 'if time', 'low priority']
        }

    def _load_model(self):
        if self.ner_model is None:
            self.ner_model = pipeline("ner", model="dslim/bert-base-NER", grouped_entities=True)

    def _extract_due_date(self, text: str):
        found_dates = search_dates(text, languages=['pt', 'en'])
        if found_dates:
            return found_dates[0][1].strftime('%Y-%m-%d')
        return None

    def _infer_priority(self, text: str) -> str:
        lower_text = text.lower()
        if any(word in lower_text for word in self.priority_keywords['high']):
            return "high"
        if any(word in lower_text for word in self.priority_keywords['low']):
            return "low"
        return "medium"

    def _infer_assignee(self, sentence: str, entities: list) -> str | None:
        ner_assignee = next((entity['word'] for entity in entities if entity['entity_group'] == 'PER'), None)
        if ner_assignee:
            return ner_assignee

        patterns = [
            r'\bque\s+([A-Z][\w]*(?:\s+[A-Z][\w]*){0,3})\s+(?:precisa|deve|needs to|will)\b',
            r'\b([A-Z][\w]*(?:\s+[A-Z][\w]*){0,3})\s+ficou\s+(?:respons[a-z]+vel|de)\b',
            r'\b([A-Z][\w]*(?:\s+[A-Z][\w]*){0,3})\s+(?:precisa|deve|needs to|will)\b',
        ]
        for pattern in patterns:
            match = re.search(pattern, sentence)
            if match:
                return match.group(1).strip()
        return None

    def extract(self, text: str) -> list:
        self._load_model()
        action_items = []
        
        sentences = re.split(r'(?<=[.!?])\s+', text)
        action_patterns = r'\b(responsible for|will|needs to|deve|precisa|responsável por|ficou de)\b'

        for sentence in sentences:
            if re.search(action_patterns, sentence, re.IGNORECASE):
                entities = self.ner_model(sentence)
                assignee = self._infer_assignee(sentence, entities)
                due_date = self._extract_due_date(sentence)
                priority = self._infer_priority(sentence)

                action_item = {
                    "task_text": sentence.strip(),
                    "original_text": sentence.strip(),
                    "assignee_name": assignee,
                    "due_date": due_date,
                    "priority": priority,
                    "confidence": 85,
                    "dependencies": [] # Placeholder for future dependency extraction
                }
                action_items.append(action_item)
        
        return action_items

action_extractor = ActionExtractor()
