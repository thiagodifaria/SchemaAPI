from transformers import pipeline

class ClassificationPipeline:
    def __init__(self):
        self.pipeline = None
        self.model_name = "facebook/bart-large-mnli"

    def _load_pipeline(self):
        if self.pipeline is None:
            self.pipeline = pipeline("zero-shot-classification", model=self.model_name)

    def classify(self, text: str, candidate_labels: list) -> list:
        self._load_pipeline()
        
        if not text or not candidate_labels:
            return []

        results = self.pipeline(text, candidate_labels, multi_label=True)
        
        classifications = []
        for i, label in enumerate(results['labels']):
            classifications.append({
                "label": label,
                "confidence": round(results['scores'][i], 4)
            })
        return classifications

classification_pipeline = ClassificationPipeline()