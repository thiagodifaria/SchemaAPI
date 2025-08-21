from transformers import pipeline

class LegalNERPipeline:
    def __init__(self):
        self.pipeline = None
        # NER-Specialized Template for English Legal Documents
        self.model_name = "maastrichtlawtech/legal-ner-bert"

    def _load_pipeline(self):
        if self.pipeline is None:
            self.pipeline = pipeline("ner", model=self.model_name, grouped_entities=True)

    def extract_legal_entities(self, text: str) -> list:
        self._load_pipeline()
        
        if not text:
            return []

        return self.pipeline(text)

legal_ner_pipeline = LegalNERPipeline()