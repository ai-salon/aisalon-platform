# Knowledge Graph Design
**Date:** 2026-04-18  
**Scope:** SocraticAI + aisalon-platform  
**Status:** Approved

---

## Overview

Build an Obsidian-style interactive knowledge graph that connects all AI Salon conversations through shared concepts, themes, and open questions. The graph is publicly explorable under the Insights section of aisalon.xyz and manageable by admins.

The system has three layers:
1. **Extraction** (SocraticAI) — parse existing article analysis into graph node candidates
2. **Storage + deduplication** (platform backend) — embed candidates, deduplicate via pgvector, persist to PostgreSQL
3. **Visualization** (Next.js frontend) — D3-force graph with Obsidian-style controls

---

## Architecture

```
SocraticAI: GraphExtractor
  └─ Parses meta.json (themes → concept candidates, insights → concept candidates,
     questions → question candidates). Returns plain data structures. No DB, no files.

Platform Backend: GraphIngestionService
  └─ Receives candidates. Computes embeddings (Google text-embedding-004).
     Queries pgvector for near-duplicates. Merges or creates nodes + edges.
     Stores in PostgreSQL. Exposes graph via API routes.

Platform Frontend: react-force-graph-2d
  └─ Public /insights/graph: published articles + concepts + questions.
     Obsidian-style force controls + filters + highlight search.
     Admin overlay: merge tool, inline label editing.
     Mobile fallback: tag-cloud layout.
```

**Integration point:** Graph extraction runs as the final step of the existing job pipeline, in the same `ThreadPoolExecutor` thread, after the `Article` row is saved to the database. Draft articles populate the graph immediately (visible to admins); the public graph filters to published articles only.

**Existing KnowledgeGraphGenerator** (Obsidian file output for CLI use) is kept unchanged. The new `GraphExtractor` is a separate class, not a replacement.

---

## Data Model

### Prerequisites

Enable pgvector on the Railway PostgreSQL instance before running migrations:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This is a one-time operation. Railway's managed PostgreSQL supports pgvector.

---

### `graph_nodes`

```sql
CREATE TABLE graph_nodes (
    id               VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    type             VARCHAR(32)  NOT NULL,   -- 'article' | 'concept' | 'question'
    label            VARCHAR(512) NOT NULL,
    description      TEXT,
    external_id      VARCHAR(36),             -- FK to external table (e.g. articles.id)
    external_table   VARCHAR(64),             -- 'articles' | future types
    embedding        vector(768),             -- NULL for article nodes
    properties       JSONB NOT NULL DEFAULT '{}',
    edge_count       INTEGER NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    parent_id        VARCHAR(36) REFERENCES graph_nodes(id),  -- nullable hierarchy
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON graph_nodes USING ivfflat (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
CREATE INDEX ON graph_nodes USING GIN (properties);
CREATE INDEX ON graph_nodes (external_table, external_id);
CREATE INDEX ON graph_nodes (type, edge_count DESC);
```

**Node types today:**
- `article` — one per salon session. `external_table='articles'`, `external_id=article.id`. `properties` stores `{ chapter_id, chapter_code, publish_date }`. No embedding.
- `concept` — recurring theme or insight cluster. Has embedding. May have `parent_id` pointing to a broader theme concept.
- `question` — open question raised across sessions. Has embedding. No `parent_id`.

**Extensibility:** New node types (e.g. `person`, `book`, `event`) require no schema changes — add a new `type` value and use `external_table`/`external_id` for the FK and `properties` for type-specific metadata.

---

### `graph_edges`

```sql
CREATE TABLE graph_edges (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   VARCHAR(36) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_id   VARCHAR(36) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    edge_type   VARCHAR(64) NOT NULL,
    weight      FLOAT NOT NULL DEFAULT 1.0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON graph_edges (source_id);
CREATE INDEX ON graph_edges (target_id);
CREATE UNIQUE INDEX ON graph_edges (source_id, target_id, edge_type);
```

**Edge types today:**
- `article_discusses` — article → concept
- `article_raises` — article → question
- `concept_related_to` — concept ↔ concept (derived from co-occurrence in ≥ 3 articles; weight = shared article count)

Edge types are open strings — new types require no schema changes.

---

### `graph_merge_candidates`

```sql
CREATE TABLE graph_merge_candidates (
    id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    node_a_id  VARCHAR(36) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    node_b_id  VARCHAR(36) NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    similarity FLOAT NOT NULL,
    source     VARCHAR(32) NOT NULL DEFAULT 'ingestion',  -- 'ingestion' | 'backfill'
    status     VARCHAR(32) NOT NULL DEFAULT 'pending',    -- 'pending' | 'merged' | 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## SocraticAI: GraphExtractor

**File:** `socraticai/content/knowledge_graph/graph_extractor.py`

No LLM calls. No filesystem. No DB. Pure transformation of `meta` dict into typed candidates.

```python
@dataclass
class NodeCandidate:
    type: str         # 'concept' | 'question'
    label: str
    description: str
    source_text: str  # original excerpt from meta

@dataclass
class GraphExtractionResult:
    concept_candidates: list[NodeCandidate]   # from themes + insights
    question_candidates: list[NodeCandidate]  # from questions
    article_properties: dict                  # pull_quotes, insights stored on article node
```

**Extraction mapping:**

| `meta` field | Output | Notes |
|---|---|---|
| `analysis.themes` | `concept` candidates | Parse `## Theme Title` headings as labels; following paragraph as description |
| `analysis.insights` | `concept` candidates | Each numbered item as a candidate; may merge into theme concepts or form child concepts |
| `analysis.questions` | `question` candidates | Each numbered item verbatim |
| `analysis.pull_quotes` | `article_properties.pull_quotes` | Stored on article node, not graph nodes |

Themes produce ~5 candidates per article; insights produce ~20. Total: up to 25 concept candidates + 20 question candidates per article, most of which will deduplicate against existing nodes over time.

---

## Platform: Graph Ingestion Service

**File:** `aisalon-platform/backend/app/services/graph.py`

Called from `run_job` in `admin.py` after `Article` is saved.

### Deduplication pipeline (per candidate)

```
1. Prepend context prefix before embedding:
   Concepts:  "Topic: {label}"
   Questions: "Question: {label}"

2. Compute embedding via Google text-embedding-004

3. Query pgvector for top-3 most similar existing nodes of same type:
   SELECT id, label, 1 - (embedding <=> $1) AS similarity
   FROM graph_nodes
   WHERE type = $type AND embedding IS NOT NULL
   ORDER BY embedding <=> $1
   LIMIT 3

4. Similarity routing:
   ≥ 0.90        → auto-merge: point new article's edges at existing node,
                   trigger description re-synthesis if description has changed
   0.72–0.90     → create node, insert into graph_merge_candidates (status='pending')
   0.60–0.72     → create as child concept; set parent_id to most similar
                   theme-concept above 0.60 threshold (concepts only)
   < 0.60        → create as new peer node
```

**Thresholds apply per type separately.** Concepts are never deduplicated against questions.

### Description re-synthesis on merge

Single Gemini Flash call with a one-sentence synthesis prompt:

```
Given two descriptions of the same concept, write one synthesized paragraph:
Existing: "{existing_description}"
New: "{new_description}"
```

Capped at 5 re-syntheses per node. After cap, description is kept and only the provenance (article references + edge count) is updated.

### Post-candidate steps

```
5. Create article graph node
   type='article', external_table='articles', external_id=article.id
   properties = { chapter_id, publish_date, pull_quotes, insights }

6. Create edges
   article_node → each concept node:  edge_type='article_discusses'
   article_node → each question node: edge_type='article_raises'
   Upsert (increment weight on conflict)

7. Update edge_count + last_activity_at on all touched nodes

8. Derive concept↔concept edges
   For any two concept nodes now sharing ≥ 3 article references,
   upsert 'concept_related_to' edge (weight = shared article count)
```

### Backfill

Triggered via `POST /admin/graph/backfill`. Processes all existing articles in `created_at` order.

**Backfill rule:** No auto-merging. Everything with similarity ≥ 0.72 goes into `graph_merge_candidates` with `source='backfill'`. Admin reviews and approves the backfill batch before nodes go live. This is a one-time operation — subsequent new articles follow normal ingestion thresholds.

---

## API Routes

### Public (no auth)

```
GET /graph
  Returns nodes + edges for published articles only.
  Node shape: { id, type, label, description, edge_count,
                last_activity_at, parent_id, properties }
  Edge shape: { source, target, edge_type, weight }
  (source/target field names are required by react-force-graph-2d)

GET /graph/nodes/{id}
  Full node detail: node data + all neighbors (1 hop) + linked articles.
  Powers the click-to-sidebar UX.
```

### Admin (JWT required)

```
GET /admin/graph/nodes
  Full graph including draft articles. Nodes include similarity scores
  and merge candidate status.

GET /admin/graph/merge-candidates?status=pending
  List of pending merge candidates ordered by similarity desc.
  Includes full node_a and node_b data for side-by-side review.

POST /admin/graph/merge
  Body: { keep_id, discard_id }
  Merges discard into keep: repoints all edges, triggers description
  re-synthesis, marks candidate 'merged', deletes discard node.

PATCH /admin/graph/nodes/{id}
  Edit label or description manually.

POST /admin/graph/backfill
  Triggers background processing of all existing articles.
  Returns { status: 'started', article_count: N }.
  Backfill runs as a FastAPI BackgroundTask; poll GET /admin/graph/backfill/status
  for { processed, total, complete }.
```

---

## Frontend

### Routing

The public "Insights" nav item becomes a dropdown:

```
/insights           → Articles (current list, default)
/insights/graph     → Concept Graph
/insights/[id]      → Article detail (unchanged)
```

### Library

`react-force-graph-2d` — Canvas-based D3-force wrapper. Same force physics as Obsidian (force-many-body, force-link, force-center, force-collide). Handles 200–500 nodes on Canvas without frame drops.

### Visual encoding

Two encodings only:

| Dimension | Encoding |
|---|---|
| **Shape + color** | Circle = concept, diamond = question, rounded-rect = article |
| **Size** | `edge_count` — more-connected nodes render larger |

Edge thickness scales with `weight`. Labels shown on hover by default; always-on above a label threshold setting.

### Control panel (collapsible, Obsidian-style)

| Group | Controls |
|---|---|
| **Filters** | Toggle node types on/off (Articles / Concepts / Questions). Admin: toggle draft visibility. |
| **Display** | Node size multiplier slider, label display (always / hover / off), edge opacity slider |
| **Forces** | Repel force (charge strength), link force (edge attraction), link distance, center force |
| **Highlight** | Search box — matching node pulses, neighbors stay bright, non-neighbors dim to 20% opacity |

Force controls map directly to D3-force simulation parameters (`d3.forceManyBody().strength()`, `d3.forceLink().strength()`, etc.), updated live as sliders move — same behavior as Obsidian.

### Interaction model

- **Click any node** → slide-in sidebar (never navigate away — preserves exploration state)
  - Article node: title, chapter, publish date, excerpt, "Read article →" CTA
  - Concept node: description, parent concept chip (if any), child concept chips, linked articles
  - Question node: description, articles that raised it, related concept chips
- **Parent concept nodes** with children: click to expand/collapse children
- **Admin only:** "Merge nodes" in floating toolbar (select two nodes → confirm dialog), double-click node label to edit inline

### Mobile (< 768px)

No force graph rendered. Replace with a tag-cloud:
- Concept nodes as pills, sized by `edge_count`, loosely grouped by parent
- Tap a concept → list of linked articles
- "View full graph on desktop" nudge

---

## Planned Extensions

### External Content Ingestion

The graph layer is fully content-agnostic. The deduplication, storage, and visualization are all reusable for content outside the AI Salon pipeline — papers, blog posts, external transcripts, reading lists.

**What's needed:**

1. **`ExternalSource` model** (platform backend):
   ```
   id, title, url, source_type ('paper' | 'blog' | 'transcript' | ...)
   author, published_date, content_md, meta (JSONB)
   status ('active' | 'archived')
   ```
   Graph nodes for external content use `external_table='external_sources'`. No graph schema changes.

2. **`GenericContentExtractor`** (SocraticAI):
   A sibling to `GraphExtractor` that takes raw text/markdown and runs a single LLM pass to produce themes, insights, and questions in the same `GraphExtractionResult` format. The platform's `GraphIngestionService` receives the output identically — it doesn't know or care whether candidates came from a Salon session or an external paper.

3. **Admin submission UI**: A simple form to paste a URL or upload content, triggering extraction + ingestion.

**Why deduplication stays in the platform, not SocraticAI:**
SocraticAI is stateless by design — it answers "what concepts are in this document?" without knowledge of prior documents. Deduplication requires comparing candidates against the full accumulated graph (all existing node embeddings), which only the platform's PostgreSQL has. Moving deduplication into SocraticAI would require a DB connection and would break its use as a standalone CLI tool.

The boundary is intentional:
- **SocraticAI:** *"what concepts, questions, and insights are in this document?"*
- **Platform:** *"have we seen these before, and how do they connect to everything else?"*

This boundary means external content ingestion slots in cleanly: write a new extractor, point it at the same ingestion service, done.

---

## What's Not In This Spec

- Real-time graph updates via WebSocket (polling on publish is sufficient for now)
- Graph search / full-text semantic search (embedding infrastructure enables this later)
- Article recommendation engine (same embeddings, different query — future feature)
- Exporting the graph as Obsidian vault markdown (the existing CLI `KnowledgeGraphGenerator` handles this separately)
- Person / event / book node types (schema supports them; extraction pipeline does not yet)
- External content submission UI and `GenericContentExtractor` (covered in Planned Extensions above)
