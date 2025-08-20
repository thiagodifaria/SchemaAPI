import psycopg2
from psycopg2 import sql
import numpy as np

class TemporalAnalysisPipeline:
    def detect_recurring_topics(self, conn) -> list:
        patterns = []
        # This query uses the LAG function to find the time between occurrences of the same topic
        query = """
        WITH TopicIntervals AS (
            SELECT
                topic_text,
                EXTRACT(EPOCH FROM (pv.created_at - LAG(pv.created_at, 1) OVER (PARTITION BY topic_text ORDER BY pv.created_at))) AS interval_seconds
            FROM topics t
            JOIN processing_versions pv ON t.processing_version_id = pv.id
        ),
        TopicStats AS (
            SELECT
                topic_text,
                COUNT(*) as occurrences,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY interval_seconds) as median_interval,
                stddev(interval_seconds) as stddev_interval
            FROM TopicIntervals
            WHERE interval_seconds IS NOT NULL
            GROUP BY topic_text
            HAVING COUNT(*) > 2
        )
        SELECT
            topic_text,
            median_interval,
            stddev_interval
        FROM TopicStats
        WHERE stddev_interval IS NOT NULL AND (stddev_interval / median_interval) < 0.1;
        """
        
        cur = conn.cursor()
        cur.execute(query)
        
        for row in cur.fetchall():
            topic, median, stddev = row
            period = "unknown"
            # 604800 seconds = 7 days, 10% tolerance
            if 544320 < median < 665280:
                period = "weekly"
            
            patterns.append({
                "pattern_type": "recurring_topic",
                "topic": topic,
                "period": period,
                "confidence": 1.0 - (stddev / median)
            })
            
        cur.close()
        return patterns

temporal_analysis_pipeline = TemporalAnalysisPipeline()