#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Maintainability audit for $ROOT_DIR =="
echo

echo "== Empty files =="
find . -type f -empty \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./dev-dist/*" | sort || true
echo

echo "== Empty directories =="
find . -type d -empty \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./dev-dist/*" | sort || true
echo

echo "== Backup / temp artifacts =="
find . -type f \( \
  -name "*.backup" -o \
  -name "*.bak" -o \
  -name "*.tmp" -o \
  -name "*.orig" -o \
  -name "*.rej" -o \
  -name ".DS_Store" \
\) \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./dev-dist/*" | sort || true
echo

echo "== Largest files (top 30) =="
find . -type f \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./dev-dist/*" \
  -print0 | xargs -0 du -h | sort -hr | head -n 30
echo

echo "== Largest source files by line count (top 30) =="
find src -type f \( \
  -name "*.ts" -o \
  -name "*.tsx" -o \
  -name "*.js" -o \
  -name "*.jsx" -o \
  -name "*.css" -o \
  -name "*.scss" \
\) -print0 | xargs -0 wc -l | sort -nr | head -n 30
echo

echo "== Largest source files by byte size (top 30) =="
find src -type f \( \
  -name "*.ts" -o \
  -name "*.tsx" -o \
  -name "*.js" -o \
  -name "*.jsx" -o \
  -name "*.css" -o \
  -name "*.scss" \
\) -print0 | xargs -0 wc -c | sort -nr | head -n 30
