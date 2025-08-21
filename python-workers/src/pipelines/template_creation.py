import psycopg2
from psycopg2 import sql
from collections import Counter

class TemplateCreationPipeline:
    def create_templates_from_structures(self, conn):
        cur = conn.cursor()
        
        # Finds hashes of structures that appear multiple times and do not yet have a template
        cur.execute("""
            SELECT ds.structure_hash, jsonb_agg(ds.features) as all_features
            FROM document_structures ds
            LEFT JOIN document_templates dt ON ds.structure_hash = dt.structure_hash
            WHERE dt.id IS NULL
            GROUP BY ds.structure_hash
            HAVING COUNT(ds.id) > 2;
        """)
        
        potential_templates = cur.fetchall()
        created_templates = []

        for structure_hash, all_features in potential_templates:
            # Logic to create a template from aggregated features, finds the most common headers
            header_counter = Counter()
            for feature_set in all_features:
                header_counter.update(feature_set.get('headers', []))
            
            common_headers = [header for header, count in header_counter.items() if count > len(all_features) / 2]
            
            if common_headers:
                template_definition = {
                    "sections": [{"name": header, "required": True} for header in sorted(common_headers)]
                }
                template_name = f"Auto-Template-{structure_hash[:8]}"
                
                cur.execute(
                    sql.SQL("""
                        INSERT INTO document_templates (id, template_name, structure_hash, structure_definition, usage_count)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s)
                    """),
                    (template_name, structure_hash, psycopg2.extras.Json(template_definition), len(all_features))
                )
                created_templates.append(template_name)
        
        conn.commit()
        cur.close()
        return created_templates

template_creation_pipeline = TemplateCreationPipeline()