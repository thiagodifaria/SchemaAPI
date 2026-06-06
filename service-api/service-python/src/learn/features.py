import math
import re
from dataclasses import dataclass


TOKEN_RE = re.compile(r"[A-Za-zÀ-ÿ0-9]+")
MONEY_RE = re.compile(r"(?:R\$|US\$)\s*\d|(?:\d{1,3}(?:\.\d{3})*,\d+)")
PERCENT_RE = re.compile(r"\(?-?\d+(?:,\d+|\.\d+)?\)?%")

SECTION_WEIGHTS = {
    "resultado": 0.95,
    "demonstra": 0.9,
    "receita": 0.86,
    "ebitda": 0.86,
    "destaque": 0.82,
    "risco": 0.78,
    "governanca": 0.72,
}


@dataclass(frozen=True)
class TextPairFeatures:
    names: list[str]
    values: list[float]


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text or "") if len(token) > 1]


def _ratio(value: float, maximum: float) -> float:
    if maximum <= 0:
        return 0.0
    return max(0.0, min(1.0, value / maximum))


def _section_score(section: str) -> float:
    lowered = (section or "").lower()
    for key, score in SECTION_WEIGHTS.items():
        if key in lowered:
            return score
    return 0.45 if section else 0.15


def extract_pair_features(query: str, text: str, section: str = "", score: float = 0.0) -> TextPairFeatures:
    query_tokens = tokenize(query)
    text_tokens = tokenize(text)
    query_set = set(query_tokens)
    text_set = set(text_tokens)
    overlap = len(query_set & text_set)
    union = len(query_set | text_set)
    text_len = len(text or "")
    digit_count = sum(char.isdigit() for char in text or "")
    money_count = len(MONEY_RE.findall(text or ""))
    percent_count = len(PERCENT_RE.findall(text or ""))
    sentence_count = max(1, len(re.findall(r"[.!?]", text or "")))

    names = [
        "term_overlap",
        "jaccard",
        "query_coverage",
        "text_length",
        "digit_density",
        "money_signal",
        "percent_signal",
        "section_signal",
        "sentence_density",
        "retrieval_score",
    ]
    values = [
        _ratio(overlap, max(1, len(query_set))),
        _ratio(overlap, max(1, union)),
        _ratio(overlap, max(1, len(query_tokens))),
        _ratio(math.log1p(text_len), math.log1p(1800)),
        _ratio(digit_count, max(1, text_len) * 0.18),
        _ratio(money_count, 4),
        _ratio(percent_count, 6),
        _section_score(section),
        _ratio(sentence_count, 12),
        max(0.0, min(1.0, float(score or 0.0))),
    ]
    return TextPairFeatures(names=names, values=values)


def feature_schema() -> list[str]:
    return extract_pair_features("", "").names
