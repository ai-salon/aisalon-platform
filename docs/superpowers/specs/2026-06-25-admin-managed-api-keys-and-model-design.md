# Admin-Managed API Keys & Model Selection

**Date:** 2026-06-25
**Bean:** AiSalon-v390
**Status:** Approved — implementing

## Problem

Today, every host and chapter lead must add their own AssemblyAI and Google API keys
before they can process a conversation. Keys are stored per-user (`UserAPIKey`), and the
LLM model used for article generation is fixed by the `ARTICLE_LLM_MODEL` env var (no UI).

We want individual hosts/chapter leads to **not** manage keys at all. Instead:

1. A superadmin sets the AssemblyAI and Google keys **once**, centrally.
2. A superadmin can **select the processing model** from the admin UI (replacing the
   env-var-only control), with a **live verification** step that confirms the chosen
   model actually works before the value is saved.
3. The per-user key UI and all "add your API keys" prompts/alerts are removed from the
   regular-user experience (kept only for the superadmin).

## Goals / Non-Goals

**Goals**
- System-wide (admin-managed) AssemblyAI + Google keys that every job uses by default.
- Admin-selectable processing model (free-text) with live test-before-save verification.
- Remove per-user key UI and user-facing key prompts/alerts.

**Non-Goals**
- Removing the `UserAPIKey` model or its `/admin/api-keys` endpoints — they are **kept**
  for possible future use; only the UI that writes them is removed.
- Per-chapter or per-upload model selection (model is a single global setting).
- Managing an Anthropic key (the platform manages Google + AssemblyAI only). Anthropic
  models remain typeable but will fail verification, which is the correct signal.

## Background (current state, verified)

- **Keys are per-user.** `UserAPIKey(user_id, provider, encrypted_key)` (`models/api_key.py`),
  unique per `(user, provider)`. Resolution lives in `services/processor.py:_get_key`
  (line ~72): user key → env-var fallback (`system_key_for`, line ~46) → raise.
- **`/admin/api-keys`** GET/POST/DELETE (`api/admin.py` ~307/331/358) are **ungated** —
  every authenticated user manages their own keys.
- **Model** is env-var only: `core/config.py:ARTICLE_LLM_MODEL` (default
  `gemini-3.1-flash-lite`), consumed at `processor.py:138` and `:233` as
  `ArticleGenerator(model=settings.ARTICLE_LLM_MODEL)`. No DB override, no UI.
- **`SystemSetting(key, encrypted_value)`** (`models/system_setting.py`) already exists,
  Fernet-encrypted, with superadmin-gated `/admin/system-settings` GET/POST/DELETE
  (`admin.py` ~1178/1198/1211) and a `_get_setting(db, key)` helper (~1240).
- **Two graph paths read user keys with NO env fallback** and will break under
  system-only keys: post-job graph ingestion (`admin.py:191`) silently skips if the job
  owner has no user key; `graph.py:_get_google_key` (~63) raises 404.
- **Supported models** (`SocraticAI/socraticai/core/llm.py:20-35`):
  Gemini `{gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3-flash-preview,
  gemini-3.1-flash-lite}`, Anthropic `{claude-haiku-4-5, claude-sonnet-4-6}`. An **unknown
  model name does not error** — `LLMChain._get_provider_from_model` logs a warning and
  defaults to Anthropic, failing only at API-call time. This is why live verification
  is required.
- **User-facing key prompts** to remove:
  - Dashboard onboarding banner: `dashboard/WelcomeDashboard.tsx` `HOST_STEPS`
    (~2051-2056) and `CHAPTER_LEAD_STEPS` (~2084-2089) "Add your API keys" step;
    `dashboard/page.tsx` computes `hasApiKey` from `GET /admin/api-keys` (~39, 48-50)
    and places it in `completedSteps` (~68-73).
  - Upload page banner: `upload/page.tsx` `missingKeys` (~193) + banner (~204-242) +
    the `apiKeys`/`keysLoaded` state and fetch (~27-28, 57-64) that feed it.
  - Superadmin `/users` page: obsolete per-user `has_api_key` onboarding column
    (`users/page.tsx:14, 275`).
  - Per-user key cards in `settings/page.tsx` (~633-812) + dead helpers.

## Design

### A. Backend — centralized resolution

New module `app/services/system_settings.py`:
- `async def get_setting(db, key) -> str | None` — select by key, Fernet-decrypt, or `None`.
- `async def set_setting(db, key, value) -> None` — upsert + encrypt.
- Key-name constants: `ASSEMBLYAI_API_KEY = "assemblyai_api_key"`,
  `GOOGLE_API_KEY = "google_api_key"`, `ARTICLE_LLM_MODEL = "article_llm_model"`.

(The existing `_get_setting` in `admin.py` is refactored to call this module so there is
one decryption path; `POST/DELETE /admin/system-settings` likewise use `set_setting`.)

**Key precedence** (in `processor.py:_get_key`, reused by graph paths):
1. Per-user `UserAPIKey` (kept; no UI writes it, so normally absent).
2. Admin `SystemSetting` (`assemblyai_api_key` / `google_api_key`).
3. Env var (`ASSEMBLYAI_API_KEY` / `GOOGLE_API_KEY`).
4. Raise "… not configured. Ask an admin to set it in Settings."

A shared async helper `resolve_provider_key(db, provider, user_id=None)` implements this so
both `processor.py` and the graph paths use identical fallback logic. The graph paths
(`admin.py:191`, `graph.py:63`) switch to it: ingestion no longer silently skips when the
owner lacks a personal key, and `graph.py` returns a key whenever any tier is set.

**Model resolution** — new `async def resolve_model(db) -> str`:
`SystemSetting['article_llm_model']` → env `settings.ARTICLE_LLM_MODEL` → SocraticAI
default. `processor.py:138/233` call `await resolve_model(db)` instead of reading
`settings.ARTICLE_LLM_MODEL` directly.

### B. Backend — admin config + live verification

Superadmin-only (`_require_admin`), in `api/admin.py`:

- `GET /admin/processing-config` →
  `{ assemblyai_set: bool, google_set: bool, model: str, model_source: "setting"|"env"|"default" }`.
  Keys report only set/not-set (never echoed); the model **value** is returned (not a secret).

- `POST /admin/processing/test` with body `{ target: "assemblyai"|"google"|"model", value: str }`
  → `{ ok: bool, message: str }`. Runs the real check in a `ThreadPoolExecutor` (external
  SDKs are sync), with a short timeout:
  - `assemblyai` → authenticated lightweight request to AssemblyAI (account/transcript
    list, no transcription billed); 200 ⇒ ok, 401 ⇒ invalid key.
  - `google` → trivial one-token Gemini generation using a known-good default model to
    validate the key.
  - `model` → trivial generation through SocraticAI's `LLMChain` using the **saved Google
    system key** + the candidate model name. This mirrors production routing exactly and
    catches the silent-fallback-to-Anthropic case (an unknown/Anthropic model fails here).
    Requires the Google system key to be saved first; if absent, returns
    `{ ok: false, message: "Save a Google API key first." }`.

Saving continues to use `POST /admin/system-settings { key, value }`. **The UI runs the
matching test first and only calls save when the test returns `ok: true`.** A failed test
blocks the save and shows `message`.

Verification calls reuse existing key-decryption and the SocraticAI import already present
for `GraphIngestionService`/`SocraticProcessor`.

### C. Frontend — Settings page

`settings/page.tsx`:
- **Remove** the per-user key block (`PROVIDERS.map`, ~633-812) and dead helpers/state:
  `PROVIDERS`, `Provider` type usages tied to it, `PROVIDER_HELP`, `ApiKeyStatusBadge`,
  `keys` state + `/admin/api-keys` fetch, `userHasKey`/`systemHasKey`,
  `handleSave`/`handleDelete`, `editing`/`helpOpen`/`value`/`saving`/`error` state used
  only by it, and the `validateApiKey` import. **Keep** `StatusBadge` (used elsewhere),
  `ChangePasswordSection`, the scheduling-URL card, and the superadmin System Settings.
- **Add** an **"AI Processing"** subsection inside the existing
  `{isSuperadmin && ( … )}` Platform Settings block, with three controls:
  - AssemblyAI API key — password input, status badge (set / not set), Verify + Save.
  - Google API key — same pattern.
  - Processing model — free-text input (default `gemini-3.1-flash-lite`), helper text
    listing known-good Gemini names, Verify + Save.
  Each control: type a value → **Verify** (calls `POST /admin/processing/test`) → on
  success **Save** becomes enabled / Save auto-runs after a passing test. Current state is
  loaded from `GET /admin/processing-config`.

### D. Frontend — remove user-facing prompts

- `WelcomeDashboard.tsx`: delete the "Add your API keys" entries from `HOST_STEPS` and
  `CHAPTER_LEAD_STEPS`.
- `dashboard/page.tsx`: remove `hasApiKey` from `completedSteps` for host and chapter_lead
  (preserve index alignment with the trimmed step arrays) and drop the now-unused
  `/admin/api-keys` fetch + `apiKeys`/`hasApiKey`.
- `upload/page.tsx`: remove the `missingKeys` banner and the `apiKeys`/`keysLoaded` state +
  fetch that only feed it. Keep the "~$1 per upload" note.
- `users/page.tsx`: remove the obsolete `has_api_key` onboarding column (it would always
  read "not configured" now). Leave the backend `has_api_key` field vestigial.

### E. Hygiene / docs / tests

- `/admin/api-keys` endpoints remain (unused by UI).
- Update `aisalon-platform/CLAUDE.md` env-var docs: keys and model now have DB (admin UI)
  overrides; document precedence.
- Tests (backend, pytest):
  - `resolve_provider_key` precedence: user → system setting → env → raise.
  - `resolve_model`: setting → env → default, with correct `model_source`.
  - `GET /admin/processing-config` shape + RBAC (superadmin only; 403 for others).
  - `POST /admin/processing/test` for each target with the external call mocked
    (ok and failure); RBAC.
  - Graph paths fall back to a system key (no silent skip / no spurious 404).
- Frontend "test": `npm run build` passes after removals/additions.

## Data flow (after change)

```
Upload (host) ──► POST /admin/jobs ──► run_job
   └─ processor.process(user_id)
        ├─ assemblyai_key = resolve_provider_key(db, assemblyai, user_id)
        │     user key? → system_setting? → env? → raise
        ├─ google_key    = resolve_provider_key(db, google, user_id)
        └─ model         = resolve_model(db)   # setting → env → default
   post-job graph ingestion ─ resolve_provider_key(db, google, owner)  # same fallback

Admin (superadmin) Settings ▸ AI Processing
   GET /admin/processing-config         → show set/not-set + current model
   type value → POST /admin/processing/test {target,value} → ok?
              → POST /admin/system-settings {key,value}     (only if ok)
```

## Risks & mitigations

- **Existing per-user keys in prod** still take precedence (tier 1). Acceptable — they were
  set intentionally; no UI to add more. If undesirable later, a cleanup migration can drop
  them. Out of scope here.
- **Admin picks an unsupported model** → caught by the live `model` test before save
  (the whole point of verification).
- **Verification cost/latency** → tests use one-token generations / free auth checks with a
  short timeout; negligible cost.
- **Graph-path behavior change** → ingestion now uses system keys; covered by tests.
