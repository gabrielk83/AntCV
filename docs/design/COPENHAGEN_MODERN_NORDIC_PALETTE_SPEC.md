# Copenhagen Modern / Nordic Minimal — authoritative palette + typography spec

Owner spec, 2026-07-22 (from two gold docx + two written spec messages). This is the
SINGLE source of truth for the Copenhagen Modern visual applied to the Nordic Minimal
style, across **preview (app.src.js/app.js) + docx export (docx-worker + docx-client)**.
Gold files:
- Layout gold: `Downloads/AntCV_regen_2026-07-15/1017_Ibsen_Photonics_CV_FIX_3.docx` (CL layout/positions).
- Palette + v5-structure gold: `Downloads/1017_Ibsen_Photonics_CL_FINAL_v3_Nordic .docx`.

## Two-tone rule (the core)
- **Section HEADS (CV) / lead-ins (CL: Why / How I see the role / What I bring / Who I am / My goal): navy `#0B4F8A`, bold.**  ← palette token `mainHeadColor` (SHIPPED 1.51.2622).
- **Slogan headline, horizontal lines, bullet accents: teal `#00746E`.**  ← `mainLineColor` / `mainBulletColor` (kept teal).

## MAIN / body column (CV)
| Element | Colour | Size / weight | Token / where |
|---|---|---|---|
| Section heads | navy `#0B4F8A` | bold | `mainHeadColor` ✅ |
| **Sub-section names** | **teal `#00746E`** | **11 pt, bold** | `mainSubHeadColor` (colour ok; enforce 11 pt) |
| **Bullet markers** | **teal `#00746E`** | — | `mainBulletColor` ✅ (owner correction: bullets teal) |
| Role name | **teal `#00746E`** | — | role-name colour (find; currently mainHeadColor-derived) |
| Company name | (default `#333333`) | **italic** | `mainCompanyColor` + italic |
| Date / years | **`#777777`** | — | `mainYearColor` (was `#595959`) |
| Body text | `#333333` | — | `mainTextColor` ✅ |
| **Main/body head underline** | **`#777777`** | — | the rule under body section heads |
| **Rule under role–company–years** | **teal `#00746E`** | **1.5 pt** | `mainLineColor`, 1.5 pt |

## SIDEBAR column (CV)
| Element | Colour | Size / weight / spacing | Token / where |
|---|---|---|---|
| **Sidebar background** | **`#DCE5EA`** | — | `sidebarBg` (was `#DDE6F2` base / `#C9D6EC` preset) |
| Sidebar section names | teal `#00746E` | bold, Calibri, **1 pt before / 1 pt after** | `sidebarHeadColor` (colour ok; enforce spacing) |
| **Rule under sidebar section names** | **teal `#00746E`** | **1.5 pt** | `sidebarLineColor` (was `#283556`) |
| Sidebar GROUP names | teal `#00746E` | — | group-name colour |
| **Sidebar group-name underline** | **`#777777`, DOUBLE** | — | double underline, grey |
| Sidebar lead-ins | navy `#283556` | bold, 10.5 pt Calibri, **3 pt before / 3 pt after** | |
| Sidebar lead-in underline | navy `#283556` | (matches lead-in) | |
| Sidebar text | navy `#283556` | bold, 10.5 pt Calibri, 3 pt before / 3 pt after | `sidebarTextColor` ✅ |

## COVER LETTER header (from the golds — no name/spec band; owner keeps name in header)
- ~122 pt top gap, then **slogan headline** (Trebuchet MS 11 pt, teal `#00746E`, bold, centred).
- **Application subtitle** below it: grey `#808080`, 10 pt bold, centred, with a **teal `#00746E` bottom rule, 1.5 pt** (the "line after the application line"). It replaces the in-heading application line (heading↔spec swap, shipped 2520/2541).
- **Specialisation line** the owner wants **teal `#00746E`**, not white.
- Section lead-ins: navy `#0B4F8A` bold **+ underline** (currently missing; owner said "dark green" verbally but the Nordic gold OOXML shows the underline as **navy**, matching the lead text — RESOLVE before rendering).
- Two **2 pt `lineRule=atLeast` split-line spacers**: after the opening, and before the closing.
- Body: justified, ~1.11× line, Calibri 10.5 pt.

## v5 CL structure (generator, not render)
Order: greeting → opening → Why → **How I see the role (role_view: lead + 3 employer bullets)** → What I bring → How I will contribute → **Who I am AT END (Professional summary / How I operate / Eligibility / My goal)** → closing.
- role_view's 3 bullets and the Who-I-am end-block must be **filled by generation** (a migrated pre-v5 letter shows unfilled `[Employer priority N]` placeholders + a lead-only Who block).
- **Foundation / Hands-on / Professionally are FOLDED into Who I am** (Professional summary + How I operate) and hidden — the owner flagged the current overlap (foundation still `on:true` while Who repeats its content).

## Implementation notes / hazards
- Colours live in palette objects in `app.src.js` + minified `app.js` (base default ~L364 + the `va.copenhagen-modern` preset ~L20152), and in the docx export (`docx-worker/src/index.js` + `antcv-docx-client.js`). Change the **Copenhagen copies only** — `#595959`/`#283556` are shared across OTHER package presets (navy/brown/teal themes), so use targeted per-token edits, never replace-all.
- The CL header / application-line sidecar (`antcv-application-line-001.js`) is under ACTIVE development by the HEADER-APP-LINE-001 lane — coordinate to avoid collision.
- Typography (11 pt sub-heads, 10.5 pt sidebar, 1 pt / 3 pt spacing) + line rules (1.5 pt, double underline) are render-code, not palette tokens.
- **Requires live visual verification** — do this in a render-capable session.

## Status
- ✅ Two-tone `mainHeadColor` → navy `#0B4F8A` (1.51.2622).
- ⬜ Everything else above — pending a render-verified pass.
