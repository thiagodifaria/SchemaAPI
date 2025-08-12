from transformers import pipeline

class FinanceNERTipeline:
    def __init__(self):
        self.pipeline = None
        # This model is specialized for financial NER, demonstrating the verticalization concept.
        self.model_name = "Jean-Baptiste/roberta-large-ner-english"

    def _load_pipeline(self):
        if self.pipeline is None:
            self.pipeline = pipeline("ner", model=self.model_name, grouped_entities=True)

    def extract_financial_entities(self, text: str) -> list:
        self._load_pipeline()
        
        if not text:
            return []

        return self.pipeline(text)

finance_ner_pipeline = FinanceNERTipeline()