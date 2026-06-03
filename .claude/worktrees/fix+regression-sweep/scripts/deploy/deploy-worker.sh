#!/usr/bin/env bash
# Deploy one AntCV worker to Cloudflare.
#
# Usage:
#   ./scripts/deploy/deploy-worker.sh proxy
#   ./scripts/deploy/deploy-worker.sh docx-worker
#   ./scripts/deploy/deploy-worker.sh c2pa-worker
#   ./scripts/deploy/deploy-worker.sh access-relay

set -euo pipefail

WORKER="${1:-}"

if [[ -z "$WORKER" ]]; then
  echo "usage: $0 <worker-name>" >&2
  echo "available: proxy docx-worker c2pa-worker access-relay" >&2
  exit 1
fi

DIR="workers/$WORKER"

if [[ ! -d "$DIR" ]]; then
  echo "error: $DIR not found (run from repo root)" >&2
  exit 1
fi

if [[ ! -f "$DIR/wrangler.toml" ]]; then
  echo "error: $DIR/wrangler.toml not found" >&2
  exit 1
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "error: wrangler not installed. npm install -g wrangler" >&2
  exit 1
fi

echo "==> Deploying worker '$WORKER' from $DIR"

cd "$DIR"
wrangler deploy

echo ""
echo "==> Done. Watch the dashboard for the first invocation and confirm logs flow."
