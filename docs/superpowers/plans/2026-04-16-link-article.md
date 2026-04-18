# Link Existing Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow chapter leads and superadmins to manually register an existing Substack post as an article record in the platform.

**Architecture:** A new `POST /admin/articles` endpoint accepts title, Substack URL, optional publish date, and optional chapter (superadmin only). The frontend `/articles` page gains a "Link Article" button that opens an inline modal form. No database migrations required — all fields map to existing columns.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js 15 + Tailwind v4 (frontend), pytest + httpx (tests)

---

## File Map

| File | Change |
|------|--------|
| `backend/app/schemas/admin.py` | Add `ArticleCreate` schema; add `date` to imports |
| `backend/app/api/admin.py` | Add `POST /admin/articles` endpoint; import `ArticleCreate` |
| `backend/tests/test_articles.py` | Add `TestCreateArticle` class |
| `frontend/src/app/(admin)/articles/page.tsx` | Add Link Article button + modal |

---

## Task 1: Add `ArticleCreate` schema

**Files:**
- Modify: `backend/app/schemas/admin.py`

- [ ] **Step 1: Add `date` to the datetime import and add the `ArticleCreate` class**

In `backend/app/schemas/admin.py`, change line 1 from:
```python
from datetime import datetime
```
to:
```python
from datetime import datetime, date
```

Then add the following class after `ArticleUpdate` (after line ~133, before the `# ── Users` section):

```python
class ArticleCreate(BaseModel):
    title: str
    substack_url: str
    published_date: date | None = None
    chapter_id: str | None = None
```

- [ ] **Step 2: Verify the schema file parses cleanly**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run python -c "from app.schemas.admin import ArticleCreate; print('OK')"
```
Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
git add app/schemas/admin.py
git commit -m "feat: add ArticleCreate schema"
```

---

## Task 2: Add `POST /admin/articles` endpoint (TDD)

**Files:**
- Modify: `backend/tests/test_articles.py`
- Modify: `backend/app/api/admin.py`

- [ ] **Step 1: Write the failing tests**

Add this class to `backend/tests/test_articles.py` (after `TestUpdateArticle`, before the `# Helper` section at the bottom):

```python
class TestCreateArticle:
    async def test_chapter_lead_creates_article(
        self, client: AsyncClient, lead_headers, sf_chapter
    ):
        r = await client.post(
            "/admin/articles",
            json={"title": "My Substack Post", "substack_url": "https://sub.stack/p/my-post"},
            headers=lead_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "My Substack Post"
        assert data["substack_url"] == "https://sub.stack/p/my-post"
        assert data["status"] == "published"
        assert data["job_id"] is None
        assert data["chapter_id"] == sf_chapter.id

    async def test_chapter_lead_chapter_id_ignored(
        self, client: AsyncClient, lead_headers, db_session, sf_chapter
    ):
        """chapter_id in body is ignored for non-superadmin; their own chapter is always used."""
        other = await _make_other_chapter(db_session)
        r = await client.post(
            "/admin/articles",
            json={
                "title": "Ignored Chapter",
                "substack_url": "https://sub.stack/p/ignored",
                "chapter_id": other.id,
            },
            headers=lead_headers,
        )
        assert r.status_code == 201
        assert r.json()["chapter_id"] == sf_chapter.id

    async def test_superadmin_creates_for_chapter(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.post(
            "/admin/articles",
            json={
                "title": "Admin Post",
                "substack_url": "https://sub.stack/p/admin",
                "chapter_id": sf_chapter.id,
            },
            headers=admin_headers,
        )
        assert r.status_code == 201
        assert r.json()["chapter_id"] == sf_chapter.id

    async def test_superadmin_requires_chapter_id(
        self, client: AsyncClient, admin_headers
    ):
        r = await client.post(
            "/admin/articles",
            json={"title": "No Chapter", "substack_url": "https://sub.stack/p/no-chapter"},
            headers=admin_headers,
        )
        assert r.status_code == 422

    async def test_published_date_stored(
        self, client: AsyncClient, lead_headers, sf_chapter
    ):
        r = await client.post(
            "/admin/articles",
            json={
                "title": "Dated Post",
                "substack_url": "https://sub.stack/p/dated",
                "published_date": "2024-03-15",
            },
            headers=lead_headers,
        )
        assert r.status_code == 201
        assert r.json()["scheduled_publish_date"] == "2024-03-15"

    async def test_requires_auth(self, client: AsyncClient):
        r = await client.post(
            "/admin/articles",
            json={"title": "x", "substack_url": "https://sub.stack/p/x"},
        )
        assert r.status_code == 401

    async def test_missing_title_rejected(
        self, client: AsyncClient, lead_headers
    ):
        r = await client.post(
            "/admin/articles",
            json={"substack_url": "https://sub.stack/p/x"},
            headers=lead_headers,
        )
        assert r.status_code == 422

    async def test_missing_substack_url_rejected(
        self, client: AsyncClient, lead_headers
    ):
        r = await client.post(
            "/admin/articles",
            json={"title": "No URL"},
            headers=lead_headers,
        )
        assert r.status_code == 422
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest tests/test_articles.py::TestCreateArticle -v
```
Expected: all tests FAIL with 404 or 405 (endpoint doesn't exist yet)

- [ ] **Step 3: Add `ArticleCreate` to the import in `admin.py`**

In `backend/app/api/admin.py`, change line 26:
```python
    ArticleResponse, ArticleUpdate,
```
to:
```python
    ArticleResponse, ArticleUpdate, ArticleCreate,
```

- [ ] **Step 4: Add the `POST /admin/articles` endpoint**

In `backend/app/api/admin.py`, insert the following immediately after line 329 (`# ── Articles ──...`) and before the existing `@router.get("/articles", ...)` at line 331:

```python
@router.post("/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.superadmin:
        if not body.chapter_id:
            raise HTTPException(status_code=422, detail="chapter_id is required for superadmins")
        chapter_id = body.chapter_id
    else:
        chapter_id = current_user.chapter_id

    article = Article(
        chapter_id=chapter_id,
        title=body.title,
        content_md="",
        substack_url=body.substack_url,
        scheduled_publish_date=body.published_date,
        status=ArticleStatus.published,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article

```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest tests/test_articles.py::TestCreateArticle -v
```
Expected: all 8 tests PASS

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest -q
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
git add app/api/admin.py tests/test_articles.py
git commit -m "feat: add POST /admin/articles endpoint for manually linking Substack posts"
```

---

## Task 3: Frontend — Link Article modal

**Files:**
- Modify: `frontend/src/app/(admin)/articles/page.tsx`

- [ ] **Step 1: Add modal state, chapter fetch, and form submit logic**

At the top of `ArticlesPage` (after the existing `useState` calls), add the following state and helper code. The full updated component state and hooks section (replacing lines 28–52 in the current file) should read:

```typescript
  const { data: session, status } = useSession();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState<Tab>("articles");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    fetchArticles();
    // Detect superadmin role and fetch chapters for the modal dropdown
    fetch(`${API_URL}/admin/chapters`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data: { id: string; name: string; role?: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setChapters(data.map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
    // Detect superadmin by checking /admin/users (superadmin-only endpoint)
    fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.ok) setIsSuperadmin(true); })
      .catch(() => {});
  }, [token]);
```

- [ ] **Step 2: Add the `handleLinkArticle` submit function**

After the existing `handleDelete` function (around line 70), add:

```typescript
  async function handleLinkArticle(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const body: Record<string, string> = {
        title: form.title,
        substack_url: form.substackUrl,
      };
      if (form.publishedDate) body.published_date = form.publishedDate;
      if (isSuperadmin && form.chapterId) body.chapter_id = form.chapterId;
      const r = await fetch(`${API_URL}/admin/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setModalError(err?.detail ?? "Failed to link article.");
        return;
      }
      const created = await r.json();
      setArticles((prev) => [created, ...prev]);
      setShowModal(false);
      setForm({ title: "", substackUrl: "", publishedDate: "", chapterId: "" });
    } finally {
      setSubmitting(false);
    }
  }
```

- [ ] **Step 3: Add the "Link Article" button to the header**

Replace the existing header block (lines 79–82 in the current file):
```tsx
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Articles</h1>
      </div>
```
with:
```tsx
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Articles</h1>
        <button
          onClick={() => { setShowModal(true); setModalError(null); }}
          style={{
            background: "#56a1d2",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Link Article
        </button>
      </div>
```

- [ ] **Step 4: Add the modal JSX**

Just before the closing `</div>` of the component return (after the articles list block, around line 265), add:

```tsx
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 12, padding: "32px 28px",
              width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 20px" }}>
              Link Existing Article
            </h2>
            <form onSubmit={handleLinkArticle} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                  Title *
                </label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                  Substack URL *
                </label>
                <input
                  required
                  type="url"
                  value={form.substackUrl}
                  onChange={(e) => setForm((f) => ({ ...f, substackUrl: e.target.value }))}
                  placeholder="https://yourpublication.substack.com/p/..."
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                  Publish Date
                </label>
                <input
                  type="date"
                  value={form.publishedDate}
                  onChange={(e) => setForm((f) => ({ ...f, publishedDate: e.target.value }))}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
              {isSuperadmin && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#696969", display: "block", marginBottom: 4 }}>
                    Chapter *
                  </label>
                  <select
                    required
                    value={form.chapterId}
                    onChange={(e) => setForm((f) => ({ ...f, chapterId: e.target.value }))}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 6,
                      border: "1.5px solid #e5e7eb", fontSize: 14, boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    <option value="">Select a chapter…</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {modalError && (
                <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{modalError}</p>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8,
                    padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#696969",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: submitting ? "#93c5e8" : "#56a1d2",
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "8px 18px", fontSize: 13, fontWeight: 700,
                    cursor: submitting ? "default" : "pointer",
                  }}
                >
                  {submitting ? "Linking…" : "Link Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify the frontend builds**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm run build
```
Expected: build completes with no errors

- [ ] **Step 6: Commit**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
git add src/app/\(admin\)/articles/page.tsx
git commit -m "feat: add Link Article modal to articles page"
```
