from transformers import pipeline

class LegalNER:
    def __init__(self):
        self.pipeline = None
        # NER-Specialized Template for English Legal Documents
        self.model_name = "Jean-Baptiste/roberta-large-ner-english"

    def _load_model(self):
        if self.pipeline is None:
            self.pipeline = pipeline("ner", model=self.model_name, grouped_entities=True)

    def extract_legal_entities(self, text: str) -> list:
        self._load_model()
        
        if not text:
            return []

        return self.pipeline(text)

legal_ner = LegalNER()
