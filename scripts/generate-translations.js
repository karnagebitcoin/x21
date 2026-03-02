#!/usr/bin/env node

/**
 * Script to parse English UI Labels.md and generate properly structured translation file
 * This creates the canonical English translation that other languages should map to
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENGLISH_LABELS_PATH = path.join(__dirname, '..', 'English UI Labels.md');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'i18n', 'locales', 'en.ts');

function parseMarkdown(content) {
  const lines = content.split('\n');
  const translations = {};
  
  for (const line of lines) {
    // Match pattern: - `key` - "value" - **Variable: {{var}}** or - `key` - "value"
    const match = line.match(/^-\s+`([^`]+)`\s+-\s+"([^"]+)"/);
    
    if (match) {
      const [, key, value] = match;
      translations[key] = value;
    }
  }
  
  return translations;
}

function generateTypeScriptFile(translations) {
  const sortedKeys = Object.keys(translations).sort();
  const lines = ['export default {', '  translation: {'];
  
  for (const key of sortedKeys) {
    const value = translations[key];
    // Escape single quotes in the value
    const escapedValue = value.replace(/'/g, "\\'");
    lines.push(`    '${key}': '${escapedValue}',`);
  }
  
  lines.push('  }');
  lines.push('};');
  lines.push('');
  
  return lines.join('\n');
}

function main() {
  console.log('Reading English UI Labels...');
  const content = fs.readFileSync(ENGLISH_LABELS_PATH, 'utf-8');
  
  console.log('Parsing translations...');
  const translations = parseMarkdown(content);
  
  console.log(`Found ${Object.keys(translations).length} translations`);
  
  console.log('Generating TypeScript file...');
  const tsContent = generateTypeScriptFile(translations);
  
  console.log(`Writing to ${OUTPUT_PATH}...`);
  fs.writeFileSync(OUTPUT_PATH, tsContent, 'utf-8');
  
  console.log('✅ Done!');
  console.log(`Generated ${OUTPUT_PATH} with ${Object.keys(translations).length} keys`);
}

main();
