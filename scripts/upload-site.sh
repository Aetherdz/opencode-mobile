#!/usr/bin/env bash
# Upload site updates to GitHub with automatic deploy to Pages.
# Usage: ./scripts/upload-site.sh [commit message]
set -euo pipefail

MSG="${1:-Auto-upload site updates}"

echo "=== Upload Site Script ==="
echo "Step 1: Check site links..."
node scripts/check-site.mjs || { echo "Site check failed"; exit 1; }

echo "Step 2: Check changes..."
git status --short || echo "No changes (clean)"

echo "Step 3: Add and commit..."
git add website/
git diff --cached --quiet || git commit -m "$MSG"

echo "Step 4: Push to origin/main..."
git push origin main

echo "Step 5: Verify Pages deploy..."
echo "Pages deploy is triggered by push (see .github/workflows/pages.yml)"
echo "Preview URL: https://aetherdz.github.io/opencode-mobile/ (after deploy)"

echo "=== Done ==="
