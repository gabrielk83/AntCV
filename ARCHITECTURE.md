# AntCV — Architecture

Reading guide to how the runtime is structured. Read this alongside `docs/plan/AntCV_Plan_v2_LockedSources.md` (the implementation plan) and the two locked source documents under `docs/design/`.

---

## One picture

```
                ┌──────────────────────────┐
                │   user's browser (PWA)   │
                │   pwa/                   │
                └────────┬─────────────────┘
                         │
                         │  HTTPS
                         │
  ┌──────────────────────┼──────────────────────┐
  │                      │                      │
  ▼                      ▼                      ▼
proxy            access-relay            docx-worker
LLM routing      KV cloud-sync           DOCX generation
JD analysis      D1 telemetry            sidebar pagination
demo enforce     delete-wipe             package palette
prompt-aug       JWT verify              ATS flatten
supervisor                                    │
     │                                        ▼
     │                                  c2pa-worker
     │                                  provenance sign
     ▼
(LLM providers:
 Anthropic, OpenAI,
 Mistral, Gemini)
```

`antcv-mcp` is a separate, optional MCP server (`workers/antcv-mcp/`) that exposes file-write, deploy, and code-search tools to AI assistants working on this repo. It is **not on the user-facing data path**. `demo-proxy` is a stripped-down proxy used for the public demo — same shape as `proxy/`, with bundled keys and rate limits.

---

## Two independent layers (locked)

`docs/plan/AntCV_Plan_v2_LockedSources.md` § 0 makes this explicit:

> Visual and writing are explicitly independent layers. A writing style does not change tokens; a package does not change section order.

Independence is enforced as a release gate in § 8.8 (the independence test). The split runs through every part of the codebase.

### Visual layer — `packages/registry.json` (Pass 2, planned)

Seven packages: Copenhagen Modern, Navy Executive, Warm Terracotta, Nordic Frost, Pampas Contemporary, Tokyo Precision, Delhi Technical. Each carries five colour tokens (`base`, `primary`, `interactive`, `bullet`, `glyph`), heading + body font, image shape and size, plus two quick-alternative palettes and dark-mode variants.

The PWA swaps `<body data-package="...">`; CSS custom properties resolve every visible colour. The DOCX worker reads the same JSON and emits the same colours into OOXML. After Pass 2 lands, `grep -E '#[0-9A-Fa-f]{6}'` outside `packages/registry.json` returns zero hits.

Source: `docs/design/Unified_Visual_Package_System.docx`. Summary in plan § 2 + § 3.

### Writing layer — `writingSystems/registry.json` (Pass 3, planned)

Twelve canonical styles (Nordic Minimal, Achievement-Driven, Measured Professional, Structured Professional, Mediterranean Formal, Prestige Structured, Credential Forward, Precision Formal, Context Rich, Cold Outreach, Research Formal, Hybrid Balanced). Each carries 17 fields: tone chips, section order, main / sidebar placement, section-format defaults, compression tolerance, length band, line density, content priorities, tone-register rule, content rule, avoid rule, semantic-constraint triple (primary / avoid / prefer), ATS behaviour, export instruction, implementation notes, plus `wordsPerBullet`, `profileChars`, and legacy aliases.

The proxy runs every section through a five-engine pipeline (see below). The DOCX worker only receives the writing-style identifier to pick the correct ATS behaviour and section-name mapping.

Source: `docs/design/Writing_System_Engine_Specification.docx`. Summary in plan § 4.

---

## Five execution engines (writing side)

From plan § 4.1, sequenced left to right:

1. **Writing System Engine** — tone, register, section naming, content priority, evidence depth, default chips. Decides what a section is *about*.
2. **Layout + Section Engine** — section order, main / sidebar placement, visibility, section-format type (one of nine: Default, Paragraph, Bullets, Unicode bullets, Hybrid 1, Hybrid 2, Hybrid 3, Table / Grid, Structured Grid). May reorder per style; except Nordic Minimal, which preserves the current template order.
3. **Density + Compression Engine** — length target, line limits, compression tolerance, evidence preservation, detail depth. Never invents metrics to satisfy density.
4. **Semantic Constraint Engine** — banned words, banned phrases, role-boundary rules, metric integrity, research-evidence integrity, triggered constraints. Runs *after* drafting, *before* polishing. The post-draft retry loop sits here — two retries on violation, third returns `flagged: true`.
5. **ATS / Export Engine** — runs only on ATS export. Flattens tables, converts glyphs to text labels (`☎` → `Phone:`, `✉` → `Email:`, etc.), normalises section names per the style's `atsBehavior`. Never alters the human-facing writing style.

The seven-step pipeline in plan § 4.7 wraps these five with a use-case classifier (step 1) and a visual-tokens-unchanged assertion (step 7).

---

## Three integrity rules (plan § 4.5)

The Semantic Constraint Engine enforces three integrity rules post-draft, peer-level with banned-word / phrase filtering:

- **Metric integrity** — never invent metrics. If a metric is missing, use scope, method, or outcome without numbers.
- **Role-boundary integrity** — do not imply account, people, or product ownership unless supported. Use "contributed", "supported", "partnered", "coordinated", or "led" only when the underlying scope supports the verb.
- **Research-evidence integrity** — do not compress away publications, thesis, methods, or grants in Research Formal. Academic evidence outranks commercial brevity.

---

## Language-partitioned semantic constraints (plan § 4.5.3)

Banned-word and banned-phrase lists do not port across languages. Both `extraBannedWords` and `extraBannedPhrases` are objects keyed by ISO 2-letter language code:

```json
{
  "extraBannedWords": {
    "en": ["multi-faceted", "client-focused", "customer-centric", "strong leader", "end-to-end"],
    "da": ["tværgående", "tværfunktionel"],
    "es": [],
    "zh": []
  }
}
```

When the proxy generates a section in `target_language = L`, the active filter is `shared_base[L] ∪ extraBannedWords[L]`. Items in other languages are not enforced; a Danish output is not filtered against English bans, and vice versa. The English shared base from source § 15 implicitly lives under `en`; per-language shared bases (Danish, Spanish, Mandarin) are bundled into the worker from `skills/antcv-writer/references/language-output.md`.

---

## Runtime topology

| Component | Folder | Role | Stateful? |
|---|---|---|---|
| PWA | `pwa/` | UI, wizard, editor, preview, kernel, showcase, top-bar, settings, JD analysis driver, exporter dispatch | LocalStorage + cloud sync via access-relay |
| proxy | `workers/proxy/` | LLM routing (Anthropic / OpenAI / Mistral / Gemini), prompt augmentation, JD analysis, kernel extraction, prompt-injection defence, BYOK qualification, demo enforcement, supervisor orchestration | Stateless; reads KV for prefs cache |
| docx-worker | `workers/docx-worker/` | OOXML generation: sidebar pagination, page breaks, photo placement, table layout, package palette resolution, ATS flatten | Stateless |
| c2pa-worker | `workers/c2pa-worker/` | C2PA provenance signing, WASM-backed | Stateless; KMS-backed signing key |
| access-relay | `workers/access-relay/` | Cloud sync of `personalInfo` + `prefs`, delete-wipe (KV + D1 cascade), LLM telemetry insertion, health aggregation | KV (blobs) + D1 (telemetry rows) |
| demo-proxy | `workers/demo-proxy/` | Public-demo variant of proxy with bundled keys + rate limits | Same as proxy |
| antcv-mcp | `workers/antcv-mcp/` | MCP server exposing repo-edit + Cloudflare-deploy tools to AI assistants. Github OAuth. **Not on the user data path.** | KV (OAuth tokens) |

Each worker has its own `wrangler.toml`. Every `wrangler.toml` carries an `[observability.logs]` block — without it, console output is invisible in the Cloudflare dashboard. The CI lint job in `.github/workflows/deploy.yml` rejects any worker missing that block.

---

## The skill, portable

`skills/antcv-writer/` packages the same writing rules as a Claude skill — entry-point `SKILL.md`, twelve per-style reference files, cascade rules, language output rules, output schema, and a JD Gap Closure protocol. The skill is what the proxy supervisor calls into; it is also runnable standalone by any agent that loads it. Anything the proxy enforces on the writing side lives in this directory as readable spec.

---

## Where to look first when something feels wrong

1. **Visual question** → `docs/design/Unified_Visual_Package_System.docx` + plan § 2 + § 3.
2. **Writing question** → `docs/design/Writing_System_Engine_Specification.docx` + plan § 4.
3. **Pipeline question** → plan § 4.7 (the seven steps).
4. **Banned-word / integrity-rule question** → plan § 4.5 + § 4.5.3.
5. **Test scope question** → plan § 8 + `TESTING.md`.
6. **AI-assistant patch question** → `CLAUDE.md` (root) + plan § 5 (hotfix discipline).
7. **Human patch question** → `CONTRIBUTING.md` (root) + plan § 5.

The two locked source documents win over the code. Raise an issue rather than patching from memory.
