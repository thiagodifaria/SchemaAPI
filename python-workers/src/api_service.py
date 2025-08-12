from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

class VectorizeRequest(BaseModel):
    text: str

class VectorizeResponse(BaseModel):
    vector: list[float]

@app.post("/vectorize", response_model=VectorizeResponse)
def vectorize(request: VectorizeRequest):
    """
    Receives a text string and returns its 384-dimension embedding vector.
    """
    vector = embedding_model.encode(request.text)
    return VectorizeResponse(vector=vector.tolist())