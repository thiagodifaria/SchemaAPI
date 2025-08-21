import re

class LegalClauseExtractorPipeline:
    def __init__(self):
        self.clause_pattern = re.compile(
            r'^(CLÁUSULA\s+[A-Zªº]+|[\d\.]+\s*[-–—.]?\s*DO\s+[A-Z\s]+|([A-Z\s]{5,}))', 
            re.IGNORECASE | re.MULTILINE
        )

    def extract_clauses(self, text: str) -> list:
        clauses = []
        matches = list(self.clause_pattern.finditer(text))

        if not matches:
            return clauses

        for i, current_match in enumerate(matches):
            clause_title = current_match.group(0).strip()
            
            start_pos = current_match.end()
            end_pos = matches[i + 1].start() if (i + 1) < len(matches) else len(text)
            
            clause_content = text[start_pos:end_pos].strip()

            clauses.append({
                "clause_type": clause_title,
                "clause_text": clause_content,
                "confidence": 90 # Confiança baseada em regras
            })
            
        return clauses

legal_clause_extractor_pipeline = LegalClauseExtractorPipeline()