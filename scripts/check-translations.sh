#!/bin/bash

# Script to check translation key coverage across locale files

LOCALES_DIR="src/i18n/locales"
BASE_LOCALE="en"

echo "📚 Checking translation completeness..."
echo ""

# Extract keys from a locale file
extract_keys() {
    grep -o "'[^']*':" "$1" | sed "s/://g" | sort
}

# Count keys
count_keys() {
    extract_keys "$1" | wc -l
}

# Get base keys
BASE_FILE="${LOCALES_DIR}/${BASE_LOCALE}.ts"
BASE_COUNT=$(count_keys "$BASE_FILE")

echo "✅ Base locale (${BASE_LOCALE}) has ${BASE_COUNT} keys"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check each locale
for locale_file in ${LOCALES_DIR}/*.ts; do
    locale=$(basename "$locale_file" .ts)
    
    # Skip base locale
    if [ "$locale" = "$BASE_LOCALE" ]; then
        continue
    fi
    
    locale_count=$(count_keys "$locale_file")
    coverage=$(echo "scale=2; ($locale_count * 100) / $BASE_COUNT" | bc)
    
    echo "📄 ${locale}: ${locale_count}/${BASE_COUNT} keys (${coverage}% coverage)"
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "To test language switching:"
echo "1. Run the app: npm run dev"
echo "2. Go to Settings > General"
echo "3. Change the language dropdown"
echo "4. Navigate through the app to see what's translated"
echo ""
