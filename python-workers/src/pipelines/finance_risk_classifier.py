from transformers import pipeline
import re

class FinanceRiskClassifierPipeline:
    def __init__(self):
        self.pipeline = None
        self.model_name = "facebook/bart-large-mnli"
        self.risk_keywords = [
            'multa', 'penalidade', 'rescisão', 'violação', 'não conformidade', 
            'penalty', 'termination', 'violation', 'non-compliance', 'breach'
        ]

    def _load_pipeline(self):
        if self.pipeline is None:
            self.pipeline = pipeline("zero-shot-classification", model=self.model_name)

    def _find_risky_clauses(self, text: str) -> list:
        clauses = []
        sentences = re.split(r'(?<=[.!?])\s+', text)
        for sentence in sentences:
            if any(keyword in sentence.lower() for keyword in self.risk_keywords):
                clauses.append(sentence.strip())
        return clauses

    def classify_risk(self, text: str) -> dict:
        self._load_pipeline()
        
        candidate_labels = ["baixo risco", "médio risco", "alto risco"]
        results = self.pipeline(text, candidate_labels, multi_label=False)
        
        risk_level = results['labels'][0]
        confidence = int(results['scores'][0] * 100)
        
        risky_clauses = self._find_risky_clauses(text)
        summary = f"Risco avaliado como '{risk_level}'. Encontradas {len(risky_clauses)} cláusulas de risco potencial."

        return {
            "risk_level": risk_level,
            "confidence": confidence,
            "summary": summary,
            "identified_clauses": risky_clauses
        }

finance_risk_classifier_pipeline = FinanceRiskClassifierPipeline()