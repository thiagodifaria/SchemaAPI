import json
from dataclasses import dataclass
from pathlib import Path

try:
    from sklearn.neural_network import MLPClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except ModuleNotFoundError:  # pragma: no cover - exercised on lean local Python installs.
    MLPClassifier = None
    Pipeline = None
    StandardScaler = None

from .features import extract_pair_features, feature_schema


MODEL_PATH = Path(__file__).resolve().parents[2] / ".models" / "relevance.json"


@dataclass
class RelevanceExample:
    query: str
    text: str
    label: int
    section: str = ""
    score: float = 0.0


def _bootstrap_examples() -> list[RelevanceExample]:
    return [
        RelevanceExample("receita liquida", "Receita Liquida cresceu 39,4% no 3T25", 1, "Resultado"),
        RelevanceExample("ebitda ajustado", "EBITDA Ajustado totalizou R$ 1.299,6 milhoes", 1, "Resultado"),
        RelevanceExample("risco financeiro", "Endividamento e divida liquida exigem acompanhamento", 1, "Riscos"),
        RelevanceExample("receita liquida", "Indice remissivo e pagina em branco", 0, "Indice"),
        RelevanceExample("ebitda ajustado", "Tabela quebrada sem legenda e sem contexto", 0, ""),
        RelevanceExample("governanca", "Contato de imprensa e informacoes legais genericas", 0, "Anexo"),
    ]


class RelevanceModel:
    """Tiny trainable reranker for evidence quality.

    Embeddings still do semantic recall. This model learns local product signals:
    query coverage, financial values, section quality and text shape. It is small
    on purpose so feedback can improve ranking without turning the API into an LLM proxy.
    """

    def __init__(self) -> None:
        self.pipeline = None
        self.examples = _bootstrap_examples()
        self._fit()

    def _vectors(self, examples: list[RelevanceExample]) -> tuple[list[list[float]], list[int]]:
        rows = [
            extract_pair_features(example.query, example.text, example.section, example.score).values
            for example in examples
        ]
        labels = [1 if example.label else 0 for example in examples]
        return rows, labels

    def _fit(self) -> None:
        if Pipeline is None or StandardScaler is None or MLPClassifier is None:
            return
        self.pipeline = Pipeline([
            ("scale", StandardScaler()),
            ("mlp", MLPClassifier(hidden_layer_sizes=(8,), activation="relu", solver="lbfgs", max_iter=300, random_state=42)),
        ])
        rows, labels = self._vectors(self.examples)
        self.pipeline.fit(rows, labels)

    def score(self, query: str, text: str, section: str = "", score: float = 0.0) -> dict:
        features = extract_pair_features(query, text, section, score)
        if self.pipeline is None:
            probability = self._fallback_score(features.values)
        else:
            probability = float(self.pipeline.predict_proba([features.values])[0][1])
        return {
            "score": round(probability, 4),
            "label": "strong" if probability >= 0.72 else "medium" if probability >= 0.45 else "weak",
            "features": dict(zip(features.names, features.values)),
            "explanation": self._explain(features.names, features.values),
        }

    def train(self, examples: list[RelevanceExample]) -> dict:
        if examples:
            self.examples.extend(examples)
        self._fit()
        return {"examples": len(self.examples), "features": feature_schema()}

    def save(self, path: Path = MODEL_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps([example.__dict__ for example in self.examples], indent=2), encoding="utf-8")

    def load(self, path: Path = MODEL_PATH) -> bool:
        if not path.exists():
            return False
        payload = json.loads(path.read_text(encoding="utf-8"))
        self.examples = [RelevanceExample(**item) for item in payload]
        self._fit()
        return True

    @staticmethod
    def _explain(names: list[str], values: list[float]) -> list[str]:
        readable = {
            "term_overlap": "termos da pergunta aparecem no trecho",
            "query_coverage": "boa cobertura da consulta",
            "money_signal": "valores financeiros detectados",
            "percent_signal": "variacoes percentuais detectadas",
            "section_signal": "secao relevante do documento",
        }
        ranked = sorted(zip(names, values), key=lambda item: item[1], reverse=True)
        return [readable[name] for name, value in ranked if value >= 0.65 and name in readable][:3]

    @staticmethod
    def _fallback_score(values: list[float]) -> float:
        # Fallback keeps local development useful even before Docker installs sklearn.
        weights = [0.2, 0.08, 0.18, 0.08, 0.06, 0.12, 0.12, 0.12, 0.02, 0.02]
        score = sum(value * weight for value, weight in zip(values, weights))
        return max(0.0, min(1.0, score))


relevance_model = RelevanceModel()
relevance_model.load()
