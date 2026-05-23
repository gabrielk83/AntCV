#!/usr/bin/env bash
# Deploy all four AntCV workers to Cloudflare.
# Stops on first failure.

set -euo pipefail

cd "$(dirname "$0")/../.."

for worker in proxy docx-worker c2pa-worker access-relay; do
  echo ""
  echo "============================================================"
  echo "  Deploying $worker"
  echo "============================================================"
  ./scripts/deploy/deploy-worker.sh "$worker"
done

echo ""
echo "All four workers deployed."
