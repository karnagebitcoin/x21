#!/usr/bin/env node

/**
 * Script to check translation completeness across all locale files
 * 
 * This script:
 * 1. Reads all locale files
 * 2. Extracts all keys from English (base) locale
 * 3. Checks which keys are missing in other locales
 * 4. Reports missing translations
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const BASE_LOCALE = 'en';

// Read a TypeScript locale file and extract translation keys
function extractKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract the translation object
  const match = content.match(/translation:\s*{([^}]+(?:{[^}]*}[^}]*)*?)}\s*}/s);
  if (!match) {
    console.error(`Failed to parse ${filePath}`);
    return [];
  }
  
  const translationContent = match[1];
  
  // Extract all keys (strings before colons)
  const keyRegex = /['"]([^'"]+)['"]\s*:/g;
  const keys = [];
  let keyMatch;
  
  while ((keyMatch = keyRegex.exec(translationContent)) !== null) {
    keys.push(keyMatch[1]);
  }
  
  return keys;
}

// Get all locale files
const localeFiles = fs.readdirSync(LOCALES_DIR)
  .filter(file => file.endsWith('.ts'))
  .map(file => file.replace('.ts', ''));

console.log('📚 Checking translation completeness...\n');
console.log(`Found ${localeFiles.length} locale files: ${localeFiles.join(', ')}\n`);

// Extract base locale keys
const basePath = path.join(LOCALES_DIR, `${BASE_LOCALE}.ts`);
const baseKeys = extractKeys(basePath);
console.log(`✅ Base locale (${BASE_LOCALE}) has ${baseKeys.length} keys\n`);

// Check each locale
const results = {};
let hasIssues = false;

localeFiles.forEach(locale => {
  if (locale === BASE_LOCALE) return;
  
  const localePath = path.join(LOCALES_DIR, `${locale}.ts`);
  const localeKeys = extractKeys(localePath);
  
  const missingKeys = baseKeys.filter(key => !localeKeys.includes(key));
  const extraKeys = localeKeys.filter(key => !baseKeys.includes(key));
  
  results[locale] = {
    total: localeKeys.length,
    missing: missingKeys,
    extra: extraKeys,
    coverage: ((localeKeys.length / baseKeys.length) * 100).toFixed(2)
  };
  
  if (missingKeys.length > 0 || extraKeys.length > 0) {
    hasIssues = true;
  }
});

// Print results
console.log('═══════════════════════════════════════════════════════════\n');

Object.entries(results).forEach(([locale, data]) => {
  const status = data.missing.length === 0 && data.extra.length === 0 ? '✅' : '⚠️';
  console.log(`${status} ${locale.toUpperCase()}: ${data.total}/${baseKeys.length} keys (${data.coverage}% coverage)`);
  
  if (data.missing.length > 0) {
    console.log(`   ❌ Missing ${data.missing.length} keys:`);
    data.missing.slice(0, 10).forEach(key => {
      console.log(`      - "${key}"`);
    });
    if (data.missing.length > 10) {
      console.log(`      ... and ${data.missing.length - 10} more`);
    }
  }
  
  if (data.extra.length > 0) {
    console.log(`   ⚡ Extra ${data.extra.length} keys (not in base):`);
    data.extra.slice(0, 5).forEach(key => {
      console.log(`      - "${key}"`);
    });
    if (data.extra.length > 5) {
      console.log(`      ... and ${data.extra.length - 5} more`);
    }
  }
  
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════\n');

if (!hasIssues) {
  console.log('🎉 All locales are in sync with the base locale!\n');
} else {
  console.log('⚠️  Some locales have missing or extra keys.\n');
  console.log('To test language switching:');
  console.log('1. Run the app: npm run dev');
  console.log('2. Go to Settings > General');
  console.log('3. Change the language dropdown');
  console.log('4. Navigate through the app to see what\'s translated\n');
  process.exit(1);
}
