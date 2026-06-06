import re
from decimal import Decimal, InvalidOperation


METRIC_ALIASES = {
    "receita liquida": "Receita Liquida",
    "ebitda ajustado": "EBITDA Ajustado",
    "margem ebitda ajustada": "Margem EBITDA Ajustada",
    "lucro liquido": "Lucro Liquido",
    "producao media total": "Producao Media Total",
}


def parse_number(value: str) -> Decimal | None:
    cleaned = value.strip().replace("R$", "").replace("%", "").replace("(", "-").replace(")", "")
    cleaned = re.sub(r"[^\d,.\-]", "", cleaned)
    if not cleaned:
        return None

    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def variation_label(value: Decimal | None) -> str | None:
    if value is None:
        return None
    if value > 0:
        return "alta"
    if value < 0:
        return "queda"
    return "estavel"


def extract_financial_facts(text: str) -> list[dict]:
    facts = []
    compact = re.sub(r"\s+", " ", text)

    for raw_name, canonical in METRIC_ALIASES.items():
        pattern = re.compile(
            rf"({raw_name}).{{0,120}}?((?:\(?-?\d{{1,3}}(?:\.\d{{3}})*(?:,\d+)?\)?%?\s*){{2,8}})",
            re.IGNORECASE,
        )
        for match in pattern.finditer(compact):
            numbers = re.findall(r"\(?-?\d{1,3}(?:\.\d{3})*(?:,\d+)?\)?%?", match.group(2))
            parsed = [parse_number(number) for number in numbers]
            parsed = [number for number in parsed if number is not None]
            if not parsed:
                continue

            current_value = parsed[0]
            annual_variation = next((number for number in parsed[2:] if abs(number) <= 200), None)
            facts.append({
                "metric": canonical,
                "current_value": str(current_value),
                "annual_variation": str(annual_variation) if annual_variation is not None else None,
                "annual_direction": variation_label(annual_variation),
                "source_snippet": match.group(0)[:420],
            })

    deduped = []
    seen = set()
    for fact in facts:
        key = (fact["metric"], fact["current_value"], fact["annual_variation"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(fact)
    return deduped[:20]


def facts_to_briefing(facts: list[dict]) -> str | None:
    if not facts:
        return None

    lines = []
    for fact in facts[:6]:
        metric = fact["metric"]
        current = fact["current_value"]
        variation = fact.get("annual_variation")
        direction = fact.get("annual_direction")
        if variation and direction:
            lines.append(f"{metric}: {current}, com {direction} de {variation}% no comparativo anual.")
        else:
            lines.append(f"{metric}: {current}.")
    return "\n".join(lines)
