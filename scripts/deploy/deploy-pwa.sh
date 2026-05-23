#!/usr/bin/env bash
# Deploy the AntCV PWA to Cloudflare Pages.
#
# Usage:
#   ./scripts/deploy/deploy-pwa.sh                    # deploys current pwa/ contents to main
#   ./scripts/deploy/deploy-pwa.sh "v1.40.336"        # deploys with a commit message
#
# Requires:
#   - wrangler installed and logged in (wrangler login)
#   - This script is run from the repo root.

set -euo pipefail

PROJECT_NAME="antcv"
BRANCH="main"
MESSAGE="${1:-PWA deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)}"

if [[ ! -d "pwa" ]]; then
  echo "error: run from repo root (pwa/ directory not found)" >&2
  exit 1
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "error: wrangler not installed. npm install -g wrangler" >&2
  exit 1
fi

echo "==> Deploying pwa/ to Cloudflare Pages project '$PROJECT_NAME' (branch: $BRANCH)"
echo "==> Commit message: $MESSAGE"

cd pwa
wrangler pages deploy . \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" \
  --commit-message="$MESSAGE"

echo ""
echo "==> Done. Run a smoke test in an incognito tab and confirm the version banner."
