#!/usr/bin/env bash
# Rebuild the minified PWA bundle from the kept source.
#   pwa/app.src.js  --(esbuild --minify)-->  pwa/app.js
set -euo pipefail
cd "$(dirname "$0")/.."
npx --no-install esbuild pwa/app.src.js --minify --legal-comments=none --outfile=pwa/app.js
node --check pwa/app.js
echo "built pwa/app.js ($(wc -c < pwa/app.js) bytes)"
