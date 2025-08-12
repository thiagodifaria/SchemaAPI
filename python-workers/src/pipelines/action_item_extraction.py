from transformers import pipeline
import re
import dateparser

class ActionItemExtractionPipeline:
    def __init__(self):
        self.ner_pipeline = None

    def _load_pipelines(self):
        if self.ner_pipeline is None:
            self.ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", grouped_entities=True)

    def _extract_due_date(self, text: str):
        # Search for dates in both Portuguese and English
        found_dates = dateparser.search.search_dates(text, languages=['pt', 'en'])
        if found_dates:
            # Return the first found date in YYYY-MM-DD format
            return found_dates[0][1].strftime('%Y-%m-%d')
        return None

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

                action_item = {
                    "task_text": sentence.strip(),
                    "original_text": sentence.strip(),
                    "assignee_name": assignee,
                    "due_date": due_date,
                    "priority": "medium",
                    "confidence": 0.85 
                }
                action_items.append(action_item)
        
        return action_items

action_item_extraction_pipeline = ActionItemExtractionPipeline()