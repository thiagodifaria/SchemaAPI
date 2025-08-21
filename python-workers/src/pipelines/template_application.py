import re

class TemplateApplicationPipeline:
    def apply_template(self, text: str, template: dict) -> dict:
        """
        Parses a text according to a given template definition.
        Returns a dictionary with section names as keys and their content as values.
        """
        structured_content = {}
        sections = template.get("sections", [])
        
        if not sections:
            return structured_content

        # Create a regex to find all headers at once
        header_patterns = [re.escape(section['name']) for section in sections]
        splitter_pattern = re.compile(f"({'|'.join(header_patterns)})", re.IGNORECASE)
        
        parts = splitter_pattern.split(text)
        if len(parts) < 2:
            return {} # Template could not be applied

        content_map = {}
        for i in range(1, len(parts), 2):
            header = parts[i].strip().lower()
            content = parts[i+1].strip() if (i + 1) < len(parts) else ""
            content_map[header] = content

        for section in sections:
            section_name = section['name'].lower()
            if section_name in content_map:
                structured_content[section_name] = content_map[section_name]
        
        return structured_content

template_application_pipeline = TemplateApplicationPipeline()