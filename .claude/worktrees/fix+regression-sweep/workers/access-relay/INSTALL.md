# AntCV D1 Build — Batch 1 (relay)

Relay source updated to `auth-13-extract-kernel`. Adds the `ant_memory` D1 database (bound as `DB` in code) plus the kernel + applications CRUD endpoints and the new `/api/profile/extract-kernel` endpoint that proxies to cv-proxy for LLM-driven kernel extraction.

## Files

| File | What |
| --- | --- |
| `src/index.js` | Updated relay (1699 → 2363 lines). New D1 helpers, kernel & application endpoints, KV→D1 lazy migration. Reads the binding as `env.DB`. |
| `schema.sql` | D1 schema for `ant_memory`: `user_kernel`, `application`, `language_view`, `active_application` tables + 3 indexes. All idempotent (`IF NOT EXISTS`). |
| `wrangler.toml` | Adds the `[[d1_databases]]` binding (`binding = "DB"`, `database_name = "ant_memory"`). **You must paste the `database_id` after creating the D1 db (step 2 below).** |
| `package.json` | Unchanged from prior version. Included for completeness. |

## Deploy steps

1. **Create the D1 database** (one-time, per environment):
   ```
   cd antcv-access-relay
   npx wrangler d1 create ant_memory
   ```
   The command prints a `database_id`. Copy it.

2. **Paste the database_id into `wrangler.toml`**, replacing the placeholder:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "ant_memory"
   database_id = "PASTE-THE-ID-HERE"
   ```

3. **Apply the schema** (remote, production):
   ```
   npx wrangler d1 execute ant_memory --file=schema.sql --remote
   ```
   The `IF NOT EXISTS` makes this idempotent — safe to re-run.

4. **Deploy the worker**:
   ```
   npx wrangler deploy
   ```

5. **Verify**: hit `https://<your-relay>.workers.dev/__diag` — should report `d1_DB_binding: true` and `version: auth-13-extract-kernel`.

## New endpoints (require Cloudflare Access auth)

| Method + path | Purpose |
| --- | --- |
| `GET /api/profile/kernel` | Read current user's kernel (or auto-migrate from legacy KV `userPrefs` if D1 is empty). Returns 200 with `{user_hash, identity, history, preferences, ...}` or 404 if no kernel exists. |
| `PUT /api/profile/kernel` | Upsert kernel. Body: `{identity?, history?, preferences?}` (JSON fields). Returns the merged row. |
| `DELETE /api/profile/kernel` | Hard-delete kernel and all owned applications (CASCADE). |
| `POST /api/profile/extract-kernel` | LLM extraction. Body: `{texts: [{filename, content}, ...], expected_name?: string}`. Forwards to cv-proxy `/api/extract-kernel`. Returns proposed kernel + `_low_confidence` + `_conflicts` + `_identity_mismatch`. Does NOT persist — PWA decides what to save via `PUT /api/profile/kernel`. |
| `GET /api/applications` | List user's applications grouped by category (`primary_tech` / `pm_tech` / `sales` / ...). Returns 12 fixed categories even if empty. |
| `POST /api/applications` | Upsert application on `(user_hash, jd_hash)`. Auto-creates kernel shell if missing. Sets `active_application` pointer. |
| `GET /api/applications/{id}` | Fetch single application. Returns 404 for both not-found and not-owned (no ownership leak). |
| `PUT /api/applications/{id}` | Update. Runs 10-row sweep over user's applications after update. |
| `DELETE /api/applications/{id}` | Hard-delete one application. |
| `GET /api/active` | Read `active_application` pointer. |
| `PUT /api/active` | Set active pointer to a specific application id. |

## Lazy KV→D1 migration

On first `GET /api/profile/kernel`, if the user has no kernel row but has data in the legacy KV `userPrefs:{user_hash}` key, the relay extracts identity/history/preferences and creates the D1 row. The KV entry is **not** deleted — kept as backup until a manual cleanup pass later.

## What's still pending (later batches)

- Batch 2: `/api/profile/extract-kernel` (LLM-based kernel extraction from uploaded files)
- Batch 3: JD-analysis prompt additions (`detected_language`, `category`, `supporting_context`)
- Batch 4: Wizard step 5 + low-confidence word cloud
- Batch 5: Applications listing UI in Settings + language override indicator
- Deferred items A–F from the brief

## Rollback

If something breaks, redeploy the previous worker version. The D1 tables can stay — they're idempotent and the old relay version simply doesn't read from them.
