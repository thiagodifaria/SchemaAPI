from transformers import pipeline

class ClassificationPipeline:
    def __init__(self):
        self.pipeline = None
        self.model_name = "facebook/bart-large-mnli"

    def _load_pipeline(self):
        if self.pipeline is None:
            self.pipeline = pipeline("zero-shot-classification", model=self.model_name)

    def classify(self, text: str, candidate_labels: list, examples: list = None) -> list:
        self._load_pipeline()
        
        if not text or not candidate_labels:
            return []

        classifier_type = "zero-shot"
        sequence_to_classify = text

        if examples:
            classifier_type = "few-shot"
            prompt_examples = "\n".join([f"Texto: \"{ex['text']}\" => Rótulo: \"{ex['label']}\"" for ex in examples])
            sequence_to_classify = f"{prompt_examples}\n---\nTexto: \"{text}\" => Rótulo: "
        
        results = self.pipeline(sequence_to_classify, candidate_labels, multi_label=True)
        
        classifications = []
        for i, label in enumerate(results['labels']):
            classifications.append({
                "label": label,
                "confidence": round(results['scores'][i], 4),
                "classifier_type": classifier_type
            })
        return classifications

classification_pipeline = ClassificationPipeline()