import psycopg2
from psycopg2 import sql

class ActiveLearningPipeline:
    def uncertainty_sampling(self, conn, processing_version_id: str):
        """
        Finds predictions with low confidence and adds them to the review queue.
        """
        items_for_review = []
        cur = conn.cursor()

        # Uncertainty sampling for classifications, finds classifications with confidence between 40% and 70%
        cur.execute("""
            SELECT id, 'classification' as type, confidence
            FROM document_classifications
            WHERE processing_version_id = %s AND confidence BETWEEN 40 AND 70;
        """, (processing_version_id,))
        
        for pred_id, pred_type, confidence in cur.fetchall():
            items_for_review.append({
                "prediction_id": pred_id,
                "prediction_type": pred_type,
                "reason": "low_confidence_classification",
                "priority": 1.0 - (abs(confidence - 50) / 50.0) # Priority is higher closer to 50%
            })

        # Future logic for other prediction types (e.g., action items) can be added here.
        
        cur.close()
        return items_for_review

active_learning_pipeline = ActiveLearningPipeline()