from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

try:
    from src.learn import RelevanceExample, feature_schema, relevance_model
except ModuleNotFoundError:
    from learn import RelevanceExample, feature_schema, relevance_model


app = FastAPI()

# This small HTTP service keeps embedding inference isolated from the Rust API.
# Rust owns orchestration and persistence; Python owns the ML model lifecycle.
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


class VectorizeRequest(BaseModel):
    text: str


class VectorizeResponse(BaseModel):
    vector: list[float]


class RelevanceScoreRequest(BaseModel):
    query: str
    text: str
    section: str = ""
    score: float = 0.0


class RelevanceTrainItem(BaseModel):
    query: str
    text: str
    label: int
    section: str = ""
    score: float = 0.0


class RelevanceTrainRequest(BaseModel):
    examples: list[RelevanceTrainItem]


@app.post("/vectorize", response_model=VectorizeResponse)
def vectorize(request: VectorizeRequest):
    vector = embedding_model.encode(request.text)
    return VectorizeResponse(vector=vector.tolist())


@app.post("/ml/relevance/score")
def score_relevance(request: RelevanceScoreRequest):
    return relevance_model.score(request.query, request.text, request.section, request.score)


@app.post("/ml/relevance/train")
def train_relevance(request: RelevanceTrainRequest):
    # Feedback examples stay compact: the model learns evidence-quality signals
    # without storing full documents or turning this service into an LLM proxy.
    examples = [
        RelevanceExample(
            query=item.query,
            text=item.text,
            label=item.label,
            section=item.section,
            score=item.score,
        )
        for item in request.examples
    ]
    result = relevance_model.train(examples)
    relevance_model.save()
    return result


@app.get("/ml/relevance/schema")
def relevance_features():
    return {"features": feature_schema()}


@app.get("/health")
def health():
    return {"status": "ok", "ml": {"relevance": "ready"}}


if __name__ == "__main__":
    import os
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("PYTHON_API_HOST", "127.0.0.1"),
        port=int(os.environ.get("PYTHON_API_PORT", "8001")),
        reload=False,
    )
