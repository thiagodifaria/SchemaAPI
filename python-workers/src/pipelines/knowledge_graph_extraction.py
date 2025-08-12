from transformers import pipeline
from collections import defaultdict
import re
import itertools

class KnowledgeGraphPipeline:
    def __init__(self):
        self.ner_pipeline = None
        self.entity_map = {
            'PER': 'person', 'ORG': 'organization', 'LOC': 'location', 'MISC': 'miscellaneous'
        }
        self.relation_patterns = {
            'manages': r'\b(manages|leads|gerencia|lidera)\b',
            'collaborates_with': r'\b(collaborates with|works with|with|junto com|com)\b',
        }

    def _load_pipelines(self):
        if self.ner_pipeline is None:
            self.ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", grouped_entities=True)

    def _infer_relationships(self, sentence, entities_in_sentence):
        relationships = []
        if len(entities_in_sentence) < 2:
            return relationships

        for pair in itertools.permutations(entities_in_sentence, 2):
            source_entity, target_entity = pair
            
            for rel_type, pattern in self.relation_patterns.items():
                if re.search(pattern, sentence, re.IGNORECASE):
                    relationships.append({
                        'source': source_entity['word'],
                        'target': target_entity['word'],
                        'type': rel_type,
                        'context': sentence.strip()
                    })
                    break 
        return relationships

    def extract_graph_components(self, chunk_texts_with_ids: list) -> tuple:
        self._load_pipelines()
        
        entities, mentions, relationships = {}, [], []
        
        for chunk_id, text in chunk_texts_with_ids:
            sentences = re.split(r'(?<=[.!?])\s+', text)
            for sentence in sentences:
                if not sentence: continue
                
                ner_results = self.ner_pipeline(sentence)
                entities_in_sentence = []

                for result in ner_results:
                    entity_name = result['word']
                    entity_type = self.entity_map.get(result['entity_group'])
                    if not entity_type: continue

                    entities_in_sentence.append(result)
                    
                    if (entity_name, entity_type) not in entities:
                        entities[(entity_name, entity_type)] = {"name": entity_name, "type": entity_type}
                    
                    mentions.append({
                        "chunk_id": chunk_id, "entity_name": entity_name, "entity_type": entity_type,
                        "mentioned_text": result['word'], "confidence": result['score']
                    })
                
                sentence_relationships = self._infer_relationships(sentence, entities_in_sentence)
                relationships.extend(sentence_relationships)
        
        return list(entities.values()), mentions, relationships

knowledge_graph_pipeline = KnowledgeGraphPipeline()