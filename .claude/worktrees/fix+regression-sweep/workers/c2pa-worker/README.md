# AntCV C2PA signing worker

Cloudflare Worker that wraps an AntCV-generated DOCX or PDF with a signed C2PA Content Credentials manifest. The manifest cryptographically binds the AI generation event to the asset, satisfying EU AI Act Article 50(2) "machine-readable, effective, robust, interoperable" marking requirements at the highest tier of the [Code of Practice on transparency of AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content).

The signed asset can be verified by any C2PA-compliant viewer (Adobe Content Credentials, the open-source `c2patool`, Microsoft Edge, etc.) without contacting AntCV's servers — the cryptographic chain is self-contained inside the file.

---

## 1. Architecture

```
                                       ┌────────────────────────────────────┐
                                       │  c2pa-rs (Rust) compiled to WASM   │
                                       │  exports sign_asset()              │
                                       └────────────────────────────────────┘
                                                       ▲
                                                       │ instantiated by
                                                       │ src/index.ts
PWA  ──►  POST /sign  ──►  antcv-c2pa-worker  ──►  WASM sign_asset()
                              │                            │
                              ▼                            ▼
                       reads worker secrets         signs with X.509 key,
                       (cert + key + TSA url)       embeds C2PA manifest,
                                                    returns signed bytes
```

The PWA does NOT call this worker directly. The flow is:
1. PWA → `antcv-docx-worker` → DOCX bytes.
2. PWA → `antcv-c2pa-worker` (this) → signed DOCX bytes.
3. PWA → blob → user downloads.

For PDF, the docx-worker's CloudConvert step happens first, then PDF goes to the C2PA worker.

---

## 2. Building the c2pa-rs WASM module

The c2pa-rs Rust crate must be compiled to a WASM module that exports `sign_asset`. The crate is at https://github.com/contentauth/c2pa-rs.

```sh
# Prerequisites
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# Build
git clone https://github.com/contentauth/c2pa-rs
cd c2pa-rs
# Use the wasm feature flag and disable default features that pull in tokio.
cargo build --release \
  --target wasm32-unknown-unknown \
  -p c2pa \
  --no-default-features \
  --features "wasm"

# Or, when c2pa-rs ships a `wasm-bindgen` adapter crate:
wasm-pack build --release --target web --out-dir pkg-web

# Copy the artefact into this worker
cp target/wasm32-unknown-unknown/release/c2pa.wasm /path/to/antcv-c2pa-worker/wasm/c2pa.wasm
```

The WASM module must export a function with this approximate signature (the exact ABI may need adjustment for `wasm-bindgen`'s generated glue):

```rust
#[no_mangle]
pub extern "C" fn sign_asset(
    bytes_ptr: *const u8, bytes_len: usize,
    manifest_ptr: *const u8, manifest_len: usize,
    key_ptr: *const u8, key_len: usize,
    cert_ptr: *const u8, cert_len: usize,
    tsa_ptr: *const u8, tsa_len: usize,
) -> *mut u8;
```

Once `wasm/c2pa.wasm` is in place, the worker's `[wasm_modules]` binding in `wrangler.toml` picks it up automatically.

The placeholder check in `src/index.ts:handleSign()` returns `signed: false, reason: "wasm_module_placeholder"` until the real WASM is in place AND the marshalling code (currently the TODO comment near the bottom of `handleSign`) is filled in.

---

## 3. Provisioning the signing certificate

The C2PA manifest must be sealed with an X.509 certificate from a certificate authority that the relying viewer trusts. There are three options, in increasing order of trust:

### Option A — Self-signed (for development only)

```sh
# Generate a key + self-signed cert valid for 1 year.
# Algorithm: ECDSA P-256 (corresponds to ES256 in the C2PA spec).
openssl ecparam -name prime256v1 -genkey -noout -out key.pem
openssl req -new -x509 -key key.pem -out cert.pem -days 365 \
  -subj "/CN=AntCV (Kanzen Konsulenter i Nord ApS)/O=Kanzen Konsulenter i Nord ApS/C=DK"

# Upload to the worker
wrangler secret put C2PA_SIGNING_KEY_PEM < key.pem
wrangler secret put C2PA_SIGNING_CERT_PEM < cert.pem
wrangler secret put C2PA_TIMESTAMP_AUTHORITY_URL <<< "http://timestamp.digicert.com"
```

Self-signed certificates produce manifests that verify cryptographically but the viewer will display a warning like "the signer's identity could not be verified". This is fine for development and for internal testing.

### Option B — C2PA test certificate (Adobe-issued for development)

The C2PA spec defines a [test trust list](https://contentauth.github.io/trust-list/) of vendors permitted to use the "AntCV Test" identity during development. This requires registration with the Content Authenticity Initiative; see https://opensource.contentauthenticity.org/docs/c2patool/getting_started/.

### Option C — Production certificate from a recognised CA

For production, obtain an X.509 code-signing certificate from one of:
- **DigiCert** (offers C2PA-specific certificates as of 2025)
- **Sectigo**
- **GlobalSign**

A "Content Authenticity" or "Code Signing" certificate (intended-use bits set for digital signature + non-repudiation) costs around €300–€600/year for small organisations. The CA performs identity verification (organisation registration documents, phone callback). The resulting certificate is trusted by the C2PA viewer ecosystem by default.

Cert + key go into Cloudflare secrets the same way as Option A.

### Timestamp authority (TSA)

The TSA URL is the RFC 3161 endpoint used by c2pa-rs to add a trusted timestamp to the signature. The timestamp lets viewers verify that the signature was valid AT THE TIME OF SIGNING even if the certificate later expires. Free public TSAs:

- `http://timestamp.digicert.com`
- `http://timestamp.sectigo.com`
- `http://timestamp.apple.com/ts01`

Use one of these, set as `C2PA_TIMESTAMP_AUTHORITY_URL` secret.

---

## 4. Deployment

```sh
cd antcv-c2pa-worker
npm install
# Set all three secrets (above)
wrangler secret put C2PA_SIGNING_KEY_PEM
wrangler secret put C2PA_SIGNING_CERT_PEM
wrangler secret put C2PA_TIMESTAMP_AUTHORITY_URL

# Deploy
wrangler deploy
```

The worker will be available at `https://antcv-c2pa-worker.<your-account>.workers.dev` by default.

Front it with a custom domain in `wrangler.toml` for production.

---

## 5. Integration with AntCV PWA

The PWA's `kl()` (PDF fallback) and `exportDocxViaWorker()` paths need to call this worker after generating the binary. Add to `antcv-docx-client.js`:

```js
async function signWithC2PA(bytes, kind, metadata) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const r = await fetch(window.ANTCV_C2PA_WORKER + '/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      asset_base64: b64,
      asset_kind: kind,
      source: { tool: 'AntCV', version: window.ANTCV_VERSION, ... },
      ai_event: { ... },
      author: { name: pi.name },
    }),
  });
  if (!r.ok) {
    console.warn('[C2PA] signing failed, shipping unsigned:', await r.text());
    return bytes; // fail-open — better to ship unsigned than block export
  }
  const json = await r.json();
  if (!json.signed) {
    console.warn('[C2PA] worker returned manifest preview only:', json.reason);
    return bytes;
  }
  const signedB64 = json.signed_asset_base64;
  const bin = atob(signedB64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
```

The configuration variable `ANTCV_C2PA_WORKER` is set via `relay-config.json` alongside the existing DOCX worker URL.

---

## 6. Manifest content (AI Act Article 50(2) compliance)

Every signed asset carries the following machine-readable assertions:

| Assertion                          | Purpose                                                              |
|------------------------------------|----------------------------------------------------------------------|
| `c2pa.actions / c2pa.created`      | Identifies the software (AntCV vX.Y.Z).                              |
| `c2pa.actions / c2pa.ai_generated` | Marks the AI generation event with model provider + instruction kind. |
| `stds.schema-org.CreativeWork`     | Schema.org author/creator info.                                       |
| `com.antcv.ai_disclosure`          | AntCV-specific block referencing EU AI Act Article 50(2) marking.    |

The combination of cryptographic seal + standardised AI-action assertion + AntCV custom block produces a manifest that is:
- **Effective** — visible to any C2PA viewer.
- **Reliable** — sealed with an X.509 signature.
- **Robust** — survives format-preserving transformations (signed binding to file hash + content hash).
- **Interoperable** — uses standard C2PA 2.0 vocabulary.

These four are the cumulative criteria in Article 50(2) of the AI Act.

---

## 7. Roadmap

- [ ] Build c2pa-rs WASM with `wasm-bindgen` ABI compatible with Cloudflare Workers.
- [ ] Wire `host.fetch_tsa` (currently throws) once the WASM module's import shape is known.
- [ ] Acceptance tests: round-trip a DOCX through `c2patool verify` to confirm signature validity.
- [ ] Add manifest signing for the existing PDF generation path (currently CloudConvert returns PDF; sign that before delivery).
- [ ] Provisioning runbook for production certificate renewal (annual).

---

**Document owner:** Gabriel Alexander Karp-Gershon
**Operator entity:** Kanzen Konsulenter i Nord ApS, Copenhagen, Denmark
**Version:** 1.0
**Date:** 18 May 2026
