from transformers import pipeline

class SummarizationPipeline:
    def __init__(self):
        self.model_name = "Falconsai/text_summarization"
        self.pipeline = None

    def _load_pipeline(self):
        if self.pipeline is None:
            self.pipeline = pipeline("summarization", model=self.model_name)

    def summarize(self, text: str) -> str:
        self._load_pipeline()

        max_input_length = 1024
        truncated_text = text[:max_input_length]

        summary_list = self.pipeline(truncated_text, max_length=150, min_length=30, do_sample=False)
        return summary_list[0]['summary_text']

summarization_pipeline = SummarizationPipeline()