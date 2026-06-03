// Type declaration for ES-module-style .wasm imports.
//
// Cloudflare's modern ES-module Workers let you import .wasm files
// directly with `import Module from './foo.wasm';`. Wrangler bundles
// the binary, instantiates it as a WebAssembly.Module, and exposes
// it as the default export.
//
// TypeScript needs this ambient declaration so the static import in
// src/index.ts (`import C2PA_WASM from '../wasm/c2pa.wasm';`)
// type-checks under "strict": true.
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
