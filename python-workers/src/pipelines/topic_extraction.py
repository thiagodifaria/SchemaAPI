from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

class TopicExtractionPipeline:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=10, ngram_range=(1, 2))

    def extract(self, texts: list[str]) -> list:
        if not texts or not any(texts):
            return []

        try:
            tfidf_matrix = self.vectorizer.fit_transform(texts)
            feature_names = np.array(self.vectorizer.get_feature_names_out())
            
            # Simple approach: sum tf-idf scores across all documents/chunks
            total_scores = np.array(tfidf_matrix.sum(axis=0)).flatten()
            
            # Sort by score and get top N topics
            top_indices = total_scores.argsort()[::-1]
            
            topics = []
            for i in top_indices:
                topic = {
                    "topic_text": feature_names[i],
                    "weight": round(float(total_scores[i]), 4),
                    "topic_type": "info" # Placeholder type
                }
                topics.append(topic)
            
            return topics

        except ValueError:
            # Handles cases where the vocabulary is empty (e.g., all stop words)
            return []

topic_extraction_pipeline = TopicExtractionPipeline()