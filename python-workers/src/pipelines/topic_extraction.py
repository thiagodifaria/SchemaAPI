from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering
import numpy as np

class TopicExtractionPipeline:
    def __init__(self, n_clusters=5):
        self.n_clusters = n_clusters
        self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))

    def extract(self, texts: list[str], embeddings: np.ndarray) -> list:
        if not texts or not any(texts) or embeddings is None or len(texts) <= self.n_clusters:
            return []

        # Group chunks based on the similarity of their embeddings.
        clustering_model = AgglomerativeClustering(n_clusters=self.n_clusters, metric='cosine', linkage='average')
        cluster_labels = clustering_model.fit_predict(embeddings)

        try:
            tfidf_matrix = self.vectorizer.fit_transform(texts)
            feature_names = np.array(self.vectorizer.get_feature_names_out())
        except ValueError:
            return []

        topics = []
        for i in range(self.n_clusters):
            # Find all texts belonging to the current cluster
            cluster_indices = np.where(cluster_labels == i)[0]
            if len(cluster_indices) == 0:
                continue

            # Find the most important term (highest TF-IDF score) within this cluster
            cluster_tfidf_matrix = tfidf_matrix[cluster_indices]
            cluster_scores = np.array(cluster_tfidf_matrix.sum(axis=0)).flatten()
            top_term_index = cluster_scores.argmax()
            
            topic_name = feature_names[top_term_index]
            topic_weight = round(float(cluster_scores.sum()), 4) # Weight is the sum of all scores in cluster

            topics.append({
                "topic_text": topic_name,
                "weight": topic_weight,
                "topic_type": "info"
            })
            
        # Sort topics by weight
        topics.sort(key=lambda x: x['weight'], reverse=True)
        return topics

topic_extraction_pipeline = TopicExtractionPipeline()