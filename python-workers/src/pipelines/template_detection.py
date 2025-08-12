import re
import json
import hashlib

class TemplateDetectionPipeline:
    def _hash_structure(self, features: dict) -> str:
        # Create a stable hash from the detected features
        feature_string = json.dumps(features, sort_keys=True)
        return hashlib.sha256(feature_string.encode('utf-8')).hexdigest()

    def extract_features(self, text: str) -> dict:
        features = {}
        
        # Simple regex to find headers like "1. Title", "1.2 Title", "## Title"
        header_pattern = re.compile(r'^(#\s*.*|\d+(?:\.\d+)*\.\s*.*)', re.MULTILINE)
        headers = header_pattern.findall(text)
        
        # Clean up headers
        cleaned_headers = [re.sub(r'^(#\s*|\d+(?:\.\d+)*\.\s*)', '', h).strip().lower() for h in headers]
        
        features['header_count'] = len(cleaned_headers)
        features['headers'] = cleaned_headers
        
        # Simple regex for bullet points
        bullet_pattern = re.compile(r'^\s*[\*\-]\s+', re.MULTILINE)
        features['bullet_point_count'] = len(bullet_pattern.findall(text))
        
        structure_hash = self._hash_structure(features)
        
        return {
            "features": features,
            "structure_hash": structure_hash
        }

template_detection_pipeline = TemplateDetectionPipeline()