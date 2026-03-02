#!/usr/bin/env python3
"""
Script to update translation files based on English UI Labels markdown
Generates properly structured i18n translation files
"""

import re
import json
from pathlib import Path

def parse_english_labels(content):
    """Parse the English UI Labels markdown file and extract key-value pairs"""
    translations = {}
    
    # Pattern to match: - `key` - "value" (with optional variable notation)
    pattern = r'^-\s+`([^`]+)`\s+-\s+"([^"]+)"'
    
    for line in content.split('\n'):
        match = re.match(pattern, line)
        if match:
            key, value = match.groups()
            translations[key] = value
    
    return translations

def generate_typescript_file(translations, sort_keys=True):
    """Generate a TypeScript file with translations"""
    keys = sorted(translations.keys()) if sort_keys else translations.keys()
    
    lines = ['export default {', '  translation: {']
    
    for key in keys:
        value = translations[key]
        # Escape single quotes and backslashes in both key and value
        escaped_key = key.replace('\\', '\\\\').replace("'", "\\'")
        escaped_value = value.replace('\\', '\\\\').replace("'", "\\'")
        lines.append(f"    '{escaped_key}': '{escaped_value}',")
    
    lines.append('  }')
    lines.append('};')
    lines.append('')
    
    return '\n'.join(lines)

def main():
    # Paths
    base_dir = Path(__file__).parent.parent
    labels_file = base_dir / 'English UI Labels.md'
    output_file = base_dir / 'src' / 'i18n' / 'locales' / 'en.ts'
    
    print(f'Reading {labels_file}...')
    with open(labels_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print('Parsing translations...')
    translations = parse_english_labels(content)
    
    print(f'Found {len(translations)} translation keys')
    
    print('Generating TypeScript file...')
    ts_content = generate_typescript_file(translations)
    
    print(f'Writing to {output_file}...')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    
    print(f'✅ Successfully generated {output_file}')
    print(f'   Total keys: {len(translations)}')
    
    # Also generate a JSON file with all keys for reference
    keys_file = base_dir / 'src' / 'i18n' / 'translation-keys.json'
    with open(keys_file, 'w', encoding='utf-8') as f:
        json.dump(sorted(translations.keys()), f, indent=2, ensure_ascii=False)
    
    print(f'✅ Generated translation keys reference: {keys_file}')

if __name__ == '__main__':
    main()
