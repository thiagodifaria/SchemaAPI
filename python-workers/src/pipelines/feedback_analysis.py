import psycopg2
from collections import defaultdict

class FeedbackAnalysisPipeline:
    def _categorize_error(self, prediction_type: str, original: dict, corrected: dict) -> str:
        # Simple categorization logic for action items
        if prediction_type == 'action_item':
            original_assignee = original.get('assignee_name') if original else None
            corrected_assignee = corrected.get('assignee_name')
            if original_assignee != corrected_assignee:
                return 'incorrect_assignee'
            
            original_date = original.get('due_date') if original else None
            corrected_date = corrected.get('due_date')
            if original_date != corrected_date:
                return 'incorrect_due_date'

        return 'uncategorized_correction'

    def analyze_feedback(self, conn) -> tuple:
        cur = conn.cursor()
        
        # Select feedback that has not been analyzed yet
        cur.execute("SELECT id, prediction_type, original_data, corrected_data FROM feedback WHERE is_analyzed = FALSE;")
        feedback_to_process = cur.fetchall()
        
        aggregated_errors = defaultdict(lambda: {"count": 0, "examples": []})
        
        for feedback_id, pred_type, orig_data, corr_data in feedback_to_process:
            if pred_type and corr_data:
                error_type = self._categorize_error(pred_type, orig_data, corr_data)
                aggregated_errors[error_type]["count"] += 1
                # Store up to 5 example IDs for this error type
                if len(aggregated_errors[error_type]["examples"]) < 5:
                    aggregated_errors[error_type]["examples"].append(feedback_id)

        processed_ids = [row[0] for row in feedback_to_process]
        
        cur.close()
        
        return aggregated_errors, processed_ids

feedback_analysis_pipeline = FeedbackAnalysisPipeline()