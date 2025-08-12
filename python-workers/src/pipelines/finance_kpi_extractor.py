import re
from decimal import Decimal, InvalidOperation

class FinanceKPIExtractorPipeline:
    def __init__(self):
        # Regex patterns for common KPIs in Portuguese and English
        # Pattern captures: (KPI Name), (Currency Symbol), (Value), (Scale like million/billion)
        self.kpi_patterns = [
            re.compile(r'(Receita\s*Líquida|Net\s*Revenue)\s*de\s*(R\$|\$|USD)\s*([\d.,]+)\s*(milhões|milhão|mil|bi|bilhões|billion|million)?', re.IGNORECASE),
            re.compile(r'(Lucro\s*Bruto|Gross\s*Profit)\s*de\s*(R\$|\$|USD)\s*([\d.,]+)\s*(milhões|milhão|mil|bi|bilhões|billion|million)?', re.IGNORECASE),
            re.compile(r'(EBITDA)\s*de\s*(R\$|\$|USD)\s*([\d.,]+)\s*(milhões|milhão|mil|bi|bilhões|billion|million)?', re.IGNORECASE),
        ]
        self.scale_multipliers = {
            'mil': 1_000,
            'milhão': 1_000_000,
            'milhões': 1_000_000,
            'million': 1_000_000,
            'bi': 1_000_000_000,
            'bilhões': 1_000_000_000,
            'billion': 1_000_000_000,
        }

    def _parse_value(self, value_str: str, scale_str: str) -> Decimal:
        # Normalize number format (e.g., "1.234,56" -> "1234.56")
        cleaned_value_str = value_str.replace('.', '').replace(',', '.')
        try:
            value = Decimal(cleaned_value_str)
            if scale_str:
                multiplier = self.scale_multipliers.get(scale_str.lower(), 1)
                value *= multiplier
            return value
        except InvalidOperation:
            return None

    def extract_kpis(self, text: str) -> list:
        kpis = []
        for pattern in self.kpi_patterns:
            matches = pattern.finditer(text)
            for match in matches:
                kpi_name, currency, value_str, scale = match.groups()
                value = self._parse_value(value_str, scale)
                
                if value is not None:
                    kpis.append({
                        "kpi_name": kpi_name.split(' ')[0].strip(), # "Receita Líquida" -> "Receita"
                        "kpi_value": value,
                        "kpi_currency": "BRL" if currency == "R$" else "USD",
                        "period": None, # Placeholder for future period extraction
                        "source_snippet": match.group(0)
                    })
        return kpis

finance_kpi_extractor_pipeline = FinanceKPIExtractorPipeline()