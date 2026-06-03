This directory holds the c2pa-rs WASM module.

The shipped `c2pa.wasm` in this folder is an 8-byte STUB — the minimum-valid WebAssembly module (magic `\0asm` + version 1) with no exports. It exists so:

  • Wrangler can resolve the static `import C2PA_WASM from '../wasm/c2pa.wasm'`
    in src/index.ts and bundle the worker successfully.
  • The worker deploys end-to-end and serves `/healthz` and `/capabilities`.
  • POST `/sign` instantiates the stub, finds no `sign_asset` export, and
    returns the structured 503 `wasm_missing_export` response (the
    graceful-degradation path already in src/index.ts at line ~218).

Until the real WASM is in place, the worker can confirm the manifest
structure but no cryptographic signature is applied.

To replace the stub with a real signing engine, see README §2 in the
worker root. The expected exports are documented in src/index.ts
above the WebAssembly.instantiate call (around line 80) and on the
sign_asset signature (around line 200).

Verify any replacement file:

  node -e "const b=require('fs').readFileSync('c2pa.wasm'); \
    console.log(WebAssembly.validate(b), 'size', b.length)"

