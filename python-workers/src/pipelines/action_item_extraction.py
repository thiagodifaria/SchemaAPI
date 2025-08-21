from transformers import pipeline
import re
import dateparser

class ActionItemExtractionPipeline:
    def __init__(self):
        self.ner_pipeline = None
        self.priority_keywords = {
            "high": ['urgente', 'imediato', 'crítico', 'prazo final', 'asap', 'urgent', 'critical'],
            "low": ['se houver tempo', 'quando possível', 'baixa prioridade', 'if time', 'low priority']
        }

    def _load_pipelines(self):
        if self.ner_pipeline is None:
            self.ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", grouped_entities=True)

    def _extract_due_date(self, text: str):
        found_dates = dateparser.search.search_dates(text, languages=['pt', 'en'])
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

    def extract(self, text: str) -> list:
        self._load_pipelines()
        action_items = []
        
        sentences = re.split(r'(?<=[.!?])\s+', text)
        action_patterns = r'\b(responsible for|will|needs to|deve|precisa|responsável por|ficou de)\b'

        for sentence in sentences:
            if re.search(action_patterns, sentence, re.IGNORECASE):
                entities = self.ner_pipeline(sentence)
                assignee = next((entity['word'] for entity in entities if entity['entity_group'] == 'PER'), None)
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

action_item_extraction_pipeline = ActionItemExtractionPipeline()