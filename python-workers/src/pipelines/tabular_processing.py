import pandas as pd
import io
import json

class TabularProcessingPipeline:
    def _detect_anomalies(self, df: pd.DataFrame) -> list:
        anomalies = []
        numeric_cols = df.select_dtypes(include=['number']).columns
        if numeric_cols.empty:
            return anomalies

        # Simple anomaly detection using Z-score on the first numeric column
        col_to_check = numeric_cols[0]
        mean = df[col_to_check].mean()
        std = df[col_to_check].std()
        
        if std > 0:
            df['z_score'] = (df[col_to_check] - mean) / std
            # Find rows where the z-score is > 3 or < -3
            outliers = df[abs(df['z_score']) > 3]
            for index, row in outliers.iterrows():
                anomalies.append({
                    "row": int(index),
                    "column": col_to_check,
                    "value": row[col_to_check],
                    "reason": "Z-score > 3",
                })
        return anomalies

    def process(self, file_bytes: bytes, file_name: str) -> dict:
        try:
            if file_name.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_bytes))
            elif file_name.endswith('.xlsx'):
                df = pd.read_excel(io.BytesIO(file_bytes))
            else:
                return None
        except Exception as e:
            print(f"Failed to parse tabular file {file_name}: {e}")
            return None

        # Schema Inference
        schema = {col: str(dtype) for col, dtype in df.dtypes.items()}

        # Summary Stats
        stats = df.describe().to_dict()

        # Anomaly Detection
        anomalies = self._detect_anomalies(df)

        # Convert data to JSON
        data_json = df.to_json(orient='records')

        return {
            "data_json": json.loads(data_json),
            "detected_schema": schema,
            "summary_stats": stats,
            "anomalies": anomalies,
            "row_count": len(df),
            "column_count": len(df.columns),
        }

tabular_processing_pipeline = TabularProcessingPipeline()