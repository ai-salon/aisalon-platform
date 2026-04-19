# Volunteer & Host Page Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the volunteer role hero, expand the application's professional links section, and add four UX improvements to the host page.

**Architecture:** Backend model + schema changes for new fields (with Alembic migration), followed by independent frontend changes to two pages. All backend changes land in one migration. Frontend tasks are independent of each other.

**Tech Stack:** FastAPI + SQLAlchemy (async) + Pydantic, Next.js 15 (client components, inline styles), Alembic for migrations, pytest-asyncio for backend tests.

---

## File Map

| File | Change |
|---|---|
| `backend/app/models/volunteer.py` | Add `resume_url`, `website_url` to `VolunteerApplication` |
| `backend/app/api/volunteer.py` | Add fields to `VolunteerApplyRequest`, `VolunteerApplicationResponse`, `apply_for_role` |
| `backend/app/models/hosting_interest.py` | Add `leadership_experience`, `support_network` to `HostingInterest` |
| `backend/app/api/hosting_interest.py` | Add fields to `HostingInterestCreate`, `HostingInterestResponse`, handler |
| `backend/alembic/versions/<hash>_add_professional_links_and_chapter_fields.py` | Migration for all 4 new columns |
| `backend/tests/test_volunteer.py` | Tests for new professional link fields |
| `frontend/src/app/(public)/volunteer/[slug]/page.tsx` | Hero simplification + professional links form |
| `frontend/src/app/(public)/host/page.tsx` | City hint, themes textarea, conditional fields, space hint |

---

## Task 1: Extend VolunteerApplication — model + API

**Files:**
- Modify: `backend/app/models/volunteer.py`
- Modify: `backend/app/api/volunteer.py`

- [ ] **Step 1: Add columns to the model**

In `backend/app/models/volunteer.py`, add two columns after `linkedin_url`:

```python
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    resume_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
```

- [ ] **Step 2: Update `VolunteerApplyRequest` in `backend/app/api/volunteer.py`**

```python
class VolunteerApplyRequest(BaseModel):
    name: str
    email: str
    city: str
    linkedin_url: str | None = None
    resume_url: str | None = None
    website_url: str | None = None
    why_interested: str
    relevant_experience: str
    availability: str
    how_heard: str | None = None
```

- [ ] **Step 3: Update `VolunteerApplicationResponse` in the same file**

```python
class VolunteerApplicationResponse(BaseModel):
    id: str
    role_id: str
    role_title: str = ""
    name: str
    email: str
    city: str
    linkedin_url: str | None
    resume_url: str | None
    website_url: str | None
    why_interested: str
    relevant_experience: str
    availability: str
    how_heard: str | None
    status: ApplicationStatus
    admin_notes: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update the `apply_for_role` handler to pass new fields**

In `apply_for_role`, change the `VolunteerApplication(...)` call:

```python
    application = VolunteerApplication(
        role_id=role.id,
        name=body.name,
        email=body.email,
        city=body.city,
        linkedin_url=body.linkedin_url,
        resume_url=body.resume_url,
        website_url=body.website_url,
        why_interested=body.why_interested,
        relevant_experience=body.relevant_experience,
        availability=body.availability,
        how_heard=body.how_heard,
    )
```

- [ ] **Step 5: Write failing tests**

Add to `backend/tests/test_volunteer.py`:

```python
async def test_apply_with_professional_links(client: AsyncClient, db_session):
    await _create_role(db_session, slug="links-role")
    payload = {
        **APPLY_PAYLOAD,
        "linkedin_url": "https://linkedin.com/in/jane",
        "resume_url": "https://docs.google.com/resume",
        "website_url": "https://jane.dev",
    }
    r = await client.post("/volunteer-roles/links-role/apply", json=payload)
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


async def test_apply_links_stored_and_returned_in_admin_view(
    client: AsyncClient, db_session, admin_headers
):
    await _create_role(db_session, slug="links-admin")
    payload = {
        **APPLY_PAYLOAD,
        "resume_url": "https://docs.google.com/resume",
        "website_url": "https://jane.dev",
    }
    apply_r = await client.post("/volunteer-roles/links-admin/apply", json=payload)
    app_id = apply_r.json()["id"]

    r = await client.get(f"/admin/volunteer-applications/{app_id}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["resume_url"] == "https://docs.google.com/resume"
    assert r.json()["website_url"] == "https://jane.dev"
    assert r.json()["linkedin_url"] is None
```

- [ ] **Step 6: Run tests — expect failure (columns don't exist in DB yet)**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest tests/test_volunteer.py::test_apply_with_professional_links tests/test_volunteer.py::test_apply_links_stored_and_returned_in_admin_view -v
```

Expected: FAIL — `OperationalError` or column-not-found error (SQLite schema is built from models, so if models are updated first, tests may actually pass here; proceed to Task 3 if they do).

---

## Task 2: Extend HostingInterest — model + API

**Files:**
- Modify: `backend/app/models/hosting_interest.py`
- Modify: `backend/app/api/hosting_interest.py`

- [ ] **Step 1: Add columns to the model**

In `backend/app/models/hosting_interest.py`, add after `space_options`:

```python
    space_options: Mapped[str | None] = mapped_column(Text, nullable=True)
    leadership_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_network: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Update `HostingInterestCreate` in `backend/app/api/hosting_interest.py`**

```python
class HostingInterestCreate(BaseModel):
    name: str
    email: str
    city: str
    interest_type: InterestType
    existing_chapter: str | None = None
    message: str | None = None
    salons_attended: str | None = None
    facilitated_before: str | None = None
    themes_interested: str | None = None
    why_hosting: str | None = None
    hosting_frequency: str | None = None
    space_options: str | None = None
    leadership_experience: str | None = None
    support_network: str | None = None
```

- [ ] **Step 3: Update `HostingInterestResponse`**

```python
class HostingInterestResponse(BaseModel):
    id: str
    name: str
    email: str
    city: str
    interest_type: InterestType
    existing_chapter: str | None
    message: str | None
    salons_attended: str | None
    facilitated_before: str | None
    themes_interested: str | None
    why_hosting: str | None
    hosting_frequency: str | None
    space_options: str | None
    leadership_experience: str | None
    support_network: str | None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update `create_hosting_interest` handler**

```python
    record = HostingInterest(
        name=body.name,
        email=body.email,
        city=body.city,
        interest_type=body.interest_type,
        existing_chapter=body.existing_chapter,
        message=body.message,
        salons_attended=body.salons_attended,
        facilitated_before=body.facilitated_before,
        themes_interested=body.themes_interested,
        why_hosting=body.why_hosting,
        hosting_frequency=body.hosting_frequency,
        space_options=body.space_options,
        leadership_experience=body.leadership_experience,
        support_network=body.support_network,
    )
```

- [ ] **Step 5: Run existing backend tests to confirm no regressions**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest -q
```

Expected: all existing tests pass (SQLite test DB is rebuilt from models each run, so new nullable columns are transparent).

- [ ] **Step 6: Commit backend model + API changes**

```bash
git add backend/app/models/volunteer.py backend/app/api/volunteer.py
git add backend/app/models/hosting_interest.py backend/app/api/hosting_interest.py
git add backend/tests/test_volunteer.py
git commit -m "feat: add professional links to volunteer applications, add chapter start fields to hosting interest"
```

---

## Task 3: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/<autogenerated>_add_professional_links_and_chapter_fields.py`

- [ ] **Step 1: Generate the migration**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run alembic revision --autogenerate -m "add_professional_links_and_chapter_fields"
```

- [ ] **Step 2: Verify the generated migration**

Open the newly created file in `backend/alembic/versions/`. Confirm it contains `add_column` calls for all four new columns:

```python
def upgrade() -> None:
    op.add_column('volunteer_application', sa.Column('resume_url', sa.String(length=512), nullable=True))
    op.add_column('volunteer_application', sa.Column('website_url', sa.String(length=512), nullable=True))
    op.add_column('hosting_interest', sa.Column('leadership_experience', sa.Text(), nullable=True))
    op.add_column('hosting_interest', sa.Column('support_network', sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column('volunteer_application', 'resume_url')
    op.drop_column('volunteer_application', 'website_url')
    op.drop_column('hosting_interest', 'leadership_experience')
    op.drop_column('hosting_interest', 'support_network')
```

If autogenerate missed columns or added extras, edit the file to match the above exactly.

- [ ] **Step 3: Apply migration to local dev DB**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run alembic upgrade head
```

Expected: `Running upgrade ... -> <hash>, add_professional_links_and_chapter_fields`

- [ ] **Step 4: Run full test suite to confirm green**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest -q
```

Expected: all tests pass including the two new volunteer tests from Task 1.

- [ ] **Step 5: Commit migration**

```bash
git add backend/alembic/versions/
git commit -m "chore: migration — add professional links and chapter start fields"
```

---

## Task 4: Frontend — Volunteer Role Page (Hero + Form)

**Files:**
- Modify: `frontend/src/app/(public)/volunteer/[slug]/page.tsx`

### Part A — Hero simplification

- [ ] **Step 1: Remove banner-image div**

In the `return` block, find:

```tsx
      {/* ── HERO ── */}
      <section id="banner" style={{ minHeight: "calc(40vh - 71px)" }}>
        <div className="banner-image" />
```

Replace with:

```tsx
      {/* ── HERO ── */}
      <section id="banner" style={{ minHeight: "calc(40vh - 71px)" }}>
```

(Delete the `<div className="banner-image" />` line entirely.)

- [ ] **Step 2: Center the role title**

Find the h1:

```tsx
            <h1 style={{ fontSize: 44, fontWeight: 800, color: "#111", margin: "0 0 14px", lineHeight: 1.15 }}>
              {role.title}
            </h1>
```

Replace with:

```tsx
            <h1 style={{ fontSize: 44, fontWeight: 800, color: "#111", margin: "0 0 14px", lineHeight: 1.15, textAlign: "center" }}>
              {role.title}
            </h1>
```

### Part B — Professional links form fields

- [ ] **Step 3: Add two new state variables**

In the state declarations section, find:

```tsx
  const [linkedinUrl, setLinkedinUrl] = useState("");
```

Replace with:

```tsx
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
```

- [ ] **Step 4: Update the POST body in `handleSubmit`**

Find:

```tsx
        body: JSON.stringify({
          name,
          email,
          city,
          linkedin_url: linkedinUrl || null,
          why_interested: whyInterested,
```

Replace with:

```tsx
        body: JSON.stringify({
          name,
          email,
          city,
          linkedin_url: linkedinUrl || null,
          resume_url: resumeUrl || null,
          website_url: websiteUrl || null,
          why_interested: whyInterested,
```

- [ ] **Step 5: Replace the LinkedIn field with three professional link fields**

Find the entire LinkedIn field `<div>`:

```tsx
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="linkedin">LinkedIn <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                  <input id="linkedin" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." style={inputStyle} />
                </div>
```

Replace with three fields (they sit inside the 2-column grid, so they'll each occupy one column):

```tsx
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="linkedin">LinkedIn <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                  <input id="linkedin" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="resume">Resume URL <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                  <input id="resume" type="url" value={resumeUrl} onChange={e => setResumeUrl(e.target.value)} placeholder="Google Doc, Dropbox, etc." style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle} htmlFor="website">Personal Website <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span></label>
                  <input id="website" type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yoursite.com" style={inputStyle} />
                </div>
```

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/(public)/volunteer/[slug]/page.tsx
git commit -m "feat: simplify volunteer role hero, expand professional links fields"
```

---

## Task 5: Frontend — Host Page (4 improvements)

**Files:**
- Modify: `frontend/src/app/(public)/host/page.tsx`

### Part A — New state variables

- [ ] **Step 1: Add state for new conditional fields**

Find the existing state declarations and add after `spaceOptions`:

```tsx
  const [leadershipExperience, setLeadershipExperience] = useState("");
  const [supportNetwork, setSupportNetwork] = useState("");
```

### Part B — City → smart chapter messaging

- [ ] **Step 2: Add a derived `matchedChapter` variable in the component body (before `return`)**

Add this just before the `return (`:

```tsx
  const matchedChapter = city.trim()
    ? chapters.find(
        (ch) => ch.name.toLowerCase() === city.trim().toLowerCase()
      )
    : null;
```

- [ ] **Step 3: Add the hint below the city input**

Find the city field `<div>`:

```tsx
                <div style={{ marginBottom: 20, gridColumn: interestType === "host_existing" ? "1" : "1 / -1" }}>
                  <label style={labelStyle} htmlFor="city">City <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco, London…" style={inputStyle} />
                </div>
```

Replace with:

```tsx
                <div style={{ marginBottom: 20, gridColumn: interestType === "host_existing" ? "1" : "1 / -1" }}>
                  <label style={labelStyle} htmlFor="city">City <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="San Francisco, London…" style={inputStyle} />
                  {city.trim() && (
                    <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: matchedChapter ? "#56a1d2" : "#696969" }}>
                      {matchedChapter
                        ? `Host with the ${matchedChapter.name} chapter`
                        : `Start the ${city.trim()} chapter`}
                    </p>
                  )}
                </div>
```

### Part C — Themes field → textarea with hint

- [ ] **Step 4: Replace the themes `<input>` with a `<textarea>`**

Find:

```tsx
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="themes_interested">
                  What themes are you interested in exploring in your Ai Salons? <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="themes_interested"
                  type="text"
                  required
                  value={themesInterested}
                  onChange={e => setThemesInterested(e.target.value)}
                  placeholder="e.g. AI and democracy, future of work…"
                  style={inputStyle}
                />
              </div>
```

Replace with:

```tsx
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="themes_interested">
                  What themes are you interested in exploring in your Ai Salons? <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <p style={hintStyle}>Share as many as you&apos;d like — they don&apos;t need to be fully formed ideas.</p>
                <textarea
                  id="themes_interested"
                  required
                  value={themesInterested}
                  onChange={e => setThemesInterested(e.target.value)}
                  rows={4}
                  placeholder="e.g. AI and democracy, future of work, art and creativity…"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
```

### Part D — Conditional start_chapter fields

- [ ] **Step 5: Add conditional fields after the themes block**

After the closing `</div>` of the themes field, add:

```tsx
              {interestType === "start_chapter" && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle} htmlFor="leadership_experience">
                      What&apos;s your experience organizing or leading groups? <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <p style={hintStyle}>Could be anything from a book club to a professional meetup.</p>
                    <textarea
                      id="leadership_experience"
                      required
                      value={leadershipExperience}
                      onChange={e => setLeadershipExperience(e.target.value)}
                      rows={3}
                      placeholder="Tell us about your experience…"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle} htmlFor="support_network">
                      Do you have people in mind who could help you get started? <span style={{ fontWeight: 400, textTransform: "none", fontSize: 12 }}>(optional)</span>
                    </label>
                    <p style={hintStyle}>Co-hosts, a venue contact, or just enthusiastic friends — anything helps.</p>
                    <textarea
                      id="support_network"
                      value={supportNetwork}
                      onChange={e => setSupportNetwork(e.target.value)}
                      rows={3}
                      placeholder="e.g. A few colleagues interested in AI, a friend with a space…"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                </>
              )}
```

- [ ] **Step 6: Update the POST body to include new fields**

Find:

```tsx
        body: JSON.stringify({
          name,
          email,
          city,
          interest_type: interestType,
          existing_chapter: interestType === "host_existing" ? existingChapter : null,
          salons_attended: salonsAttended || null,
          facilitated_before: facilitatedBefore || null,
          themes_interested: themesInterested || null,
          why_hosting: whyHosting || null,
          hosting_frequency: hostingFrequency || null,
          space_options: spaceOptions.length > 0 ? spaceOptions.join(", ") : null,
        }),
```

Replace with:

```tsx
        body: JSON.stringify({
          name,
          email,
          city,
          interest_type: interestType,
          existing_chapter: interestType === "host_existing" ? existingChapter : null,
          salons_attended: salonsAttended || null,
          facilitated_before: facilitatedBefore || null,
          themes_interested: themesInterested || null,
          why_hosting: whyHosting || null,
          hosting_frequency: hostingFrequency || null,
          space_options: spaceOptions.length > 0 ? spaceOptions.join(", ") : null,
          leadership_experience: interestType === "start_chapter" ? (leadershipExperience || null) : null,
          support_network: interestType === "start_chapter" ? (supportNetwork || null) : null,
        }),
```

### Part E — Space to host hint text

- [ ] **Step 7: Update the space-to-host hint paragraph**

Find:

```tsx
                <p style={hintStyle}>
                  Having a space is the most important thing to make this easy. Hosts have used their own apartments, public spaces like libraries, co-working or social areas.
                </p>
```

Replace with:

```tsx
                <p style={hintStyle}>
                  Having a space is the most important thing to make this easy. Hosts have used their own apartments, public spaces like libraries, co-working or social areas, or local businesses like restaurants, bars, and cafés.
                </p>
```

- [ ] **Step 8: Build to verify no TypeScript errors**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/(public)/host/page.tsx
git commit -m "feat: host page — city chapter hint, themes textarea, chapter start fields, space hint update"
```

---

## Task 6: Final verification and merge

- [ ] **Step 1: Run full backend test suite**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run pytest -q
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 3: Merge to develop and push**

```bash
git checkout develop
git merge --no-ff <feature-branch-name>
git push origin develop
```

- [ ] **Step 4: Delete the feature branch**

```bash
git branch -d <feature-branch-name>
git push origin --delete <feature-branch-name>
```
