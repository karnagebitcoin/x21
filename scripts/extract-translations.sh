#!/bin/bash

# Extract translations from English UI Labels.md
# Format: - `key` - "value"

INPUT_FILE="English UI Labels.md"
TEMP_FILE="/tmp/translations.txt"

echo "Extracting translations from $INPUT_FILE..."

# Extract lines matching the pattern: - `key` - "value"
grep -E '^\s*-\s+`[^`]+`\s+-\s+"[^"]+"' "$INPUT_FILE" | \
    sed -E 's/^\s*-\s+`([^`]+)`\s+-\s+"([^"]+)".*/\1||||\2/' > "$TEMP_FILE"

echo "Found $(wc -l < "$TEMP_FILE") translations"
cat "$TEMP_FILE"
