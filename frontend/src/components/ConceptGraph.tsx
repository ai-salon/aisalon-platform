'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ForceGraph2D requires browser APIs — SSR must be off
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type GraphNodeSummary = {
  id: string;
  type: string;
  label: string;
  description: string | null;
  edge_count: number;
  parent_id: string | null;
};

type GraphEdgeSummary = {
  source: string;
  target: string;
  edge_type: string;
  weight: number;
};

type GraphResponse = {
  nodes: GraphNodeSummary[];
  edges: GraphEdgeSummary[];
};

type LinkedArticle = {
  id: string;
  title: string;
  chapter_id: string;
  publish_date: string | null;
  substack_url: string | null;
};

type NodeDetail = GraphNodeSummary & {
  neighbors: GraphNodeSummary[];
  linked_articles: LinkedArticle[];
  children: GraphNodeSummary[];
};

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const NODE_COLORS: Record<string, string> = {
  article: '#56a1d2',
  concept: '#d2b356',
  question: '#9b7fd4',
};

const TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  concept: 'Concept',
  question: 'Open Question',
};

const BG_COLOR = '#1a1a2e';
const LINK_COLOR = 'rgba(255,255,255,0.10)';

function nodeRadius(edgeCount: number): number {
  return Math.max(3, Math.sqrt((edgeCount ?? 0) + 1) * 4);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

export default function ConceptGraph() {
  const [rawData, setRawData] = useState<GraphResponse>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [showArticles, setShowArticles] = useState(true);
  const [showConcepts, setShowConcepts] = useState(true);
  const [showQuestions, setShowQuestions] = useState(true);

  // Search
  const [search, setSearch] = useState('');
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Layout
  const [controlsOpen, setControlsOpen] = useState(true);
  const [dim, setDim] = useState({ w: 800, h: 600 });

  const graphRef = useRef<any>(null);

  // ── Dimensions ────────────────────────────────────────────────────────────

  useEffect(() => {
    function update() {
      setDim({ w: window.innerWidth, h: window.innerHeight - 71 });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Fetch graph ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_URL}/graph`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: GraphResponse) => {
        setRawData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }, []);

  // ── Search highlight ──────────────────────────────────────────────────────

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setHighlightIds(new Set()); return; }
    setHighlightIds(
      new Set(rawData.nodes.filter(n => n.label.toLowerCase().includes(q)).map(n => n.id))
    );
  }, [search, rawData.nodes]);

  // ── Filtered graph ────────────────────────────────────────────────────────

  const graphData = useMemo(() => {
    const activeTypes = new Set<string>([
      ...(showArticles ? ['article'] : []),
      ...(showConcepts ? ['concept'] : []),
      ...(showQuestions ? ['question'] : []),
    ]);
    const nodes = rawData.nodes.filter(n => activeTypes.has(n.type));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = rawData.edges.filter(e => {
      const src = typeof e.source === 'object' ? (e.source as { id: string }).id : e.source;
      const tgt = typeof e.target === 'object' ? (e.target as { id: string }).id : e.target;
      return nodeIds.has(src) && nodeIds.has(tgt);
    });
    return { nodes, links };
  }, [rawData, showArticles, showConcepts, showQuestions]);

  // ── Fetch node detail ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) { setNodeDetail(null); return; }
    setDetailLoading(true);
    fetch(`${API_URL}/graph/nodes/${selectedId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { setNodeDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Node click ────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((node: any) => {
    setSelectedId(prev => (prev === node.id ? null : node.id));
  }, []);

  // ── Canvas painting ───────────────────────────────────────────────────────

  const searching = search.trim().length > 0;

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = nodeRadius(node.edge_count);
    const baseColor = NODE_COLORS[node.type] ?? '#888';
    const isSelected = node.id === selectedId;
    const isHighlit = highlightIds.has(node.id);
    const alpha = searching ? (isHighlit ? 1 : 0.12) : 1;

    // Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected ? '#ffffff' : hexToRgba(baseColor, alpha);
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3 / globalScale, 0, 2 * Math.PI);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Label: always show for concepts/questions; show for articles only when zoomed
    const showLabel = node.type !== 'article' || r * globalScale > 12;
    if (showLabel) {
      const fontSize = Math.max(2, Math.min(14, 11 / globalScale));
      ctx.font = `${fontSize}px "Open Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = searching && !isHighlit
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(255,255,255,0.82)';
      const maxChars = 24;
      const label = node.label.length > maxChars ? node.label.slice(0, maxChars) + '…' : node.label;
      ctx.fillText(label, node.x, node.y + r + 2 / globalScale);
    }
  }, [selectedId, highlightIds, searching]);

  const nodePointerAreaPaint = useCallback(
      (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node.edge_count) + 4;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  // ── Stats for empty state ─────────────────────────────────────────────────

  const conceptCount = rawData.nodes.filter(n => n.type === 'concept').length;
  const questionCount = rawData.nodes.filter(n => n.type === 'question').length;
  const articleCount = rawData.nodes.filter(n => n.type === 'article').length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - 71px)', background: BG_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <i className="fa fa-circle-o-notch fa-spin" style={{ fontSize: 32, marginBottom: 16, display: 'block' }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 14 }}>Loading concept graph…</p>
        </div>
      </div>
    );
  }

  if (error || rawData.nodes.length === 0) {
    return (
      <div style={{ height: 'calc(100vh - 71px)', background: BG_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', maxWidth: 360, padding: '0 24px' }}>
          <i className="fa fa-share-alt" style={{ fontSize: 40, marginBottom: 16, display: 'block', color: '#d2b356' }} aria-hidden="true" />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
            Graph not yet populated
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
            The concept graph builds automatically as articles are processed. Check back after the next publication.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: dim.h, overflow: 'hidden', background: BG_COLOR }}>

      {/* ── Graph canvas ── */}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dim.w}
        height={dim.h}
        backgroundColor={BG_COLOR}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={() => LINK_COLOR}
        linkWidth={link => Math.max(0.5, ((link as GraphEdgeSummary).weight ?? 1) * 0.4)}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setSelectedId(null)}
        enableNodeDrag
        enableZoomInteraction
        cooldownTicks={120}
      />

      {/* ── Controls panel ── */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(15,15,30,0.88)',
        backdropFilter: 'blur(8px)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.10)',
        minWidth: 200,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <button
          onClick={() => setControlsOpen(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '10px 14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          <i className="fa fa-sliders" aria-hidden="true" />
          Controls
          <i
            className={`fa fa-angle-${controlsOpen ? 'up' : 'down'}`}
            style={{ marginLeft: 'auto', opacity: 0.6 }}
            aria-hidden="true"
          />
        </button>

        {controlsOpen && (
          <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Search */}
            <div style={{ marginTop: 12 }}>
              <input
                type="text"
                placeholder="Search nodes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              {search && highlightIds.size > 0 && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  {highlightIds.size} match{highlightIds.size !== 1 ? 'es' : ''}
                </p>
              )}
            </div>

            {/* Type filters */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
                Show
              </span>
              <FilterToggle
                label={`Concepts (${rawData.nodes.filter(n => n.type === 'concept').length})`}
                color={NODE_COLORS.concept}
                checked={showConcepts}
                onChange={setShowConcepts}
              />
              <FilterToggle
                label={`Questions (${rawData.nodes.filter(n => n.type === 'question').length})`}
                color={NODE_COLORS.question}
                checked={showQuestions}
                onChange={setShowQuestions}
              />
              <FilterToggle
                label={`Articles (${rawData.nodes.filter(n => n.type === 'article').length})`}
                color={NODE_COLORS.article}
                checked={showArticles}
                onChange={setShowArticles}
              />
            </div>

            {/* Stats */}
            <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {graphData.nodes.length} nodes · {graphData.links.length} edges
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Node detail sidebar ── */}
      {selectedId && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: Math.min(340, dim.w - 40),
          background: 'rgba(15,15,30,0.92)',
          backdropFilter: 'blur(12px)',
          borderLeft: '1px solid rgba(255,255,255,0.10)',
          overflowY: 'auto',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Close */}
          <button
            onClick={() => setSelectedId(null)}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
            aria-label="Close"
          >
            <i className="fa fa-times" aria-hidden="true" />
          </button>

          {detailLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-circle-o-notch fa-spin" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 24 }} aria-hidden="true" />
            </div>
          ) : nodeDetail ? (
            <NodeDetailPanel detail={nodeDetail} />
          ) : null}
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        display: 'flex',
        gap: 14,
        background: 'rgba(15,15,30,0.75)',
        backdropFilter: 'blur(6px)',
        borderRadius: 8,
        padding: '6px 12px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {TYPE_LABELS[type]}
          </span>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function FilterToggle({
  label, color, checked, onChange,
}: {
  label: string; color: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: checked ? '#fff' : 'rgba(255,255,255,0.35)', userSelect: 'none' }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        background: checked ? color : 'rgba(255,255,255,0.12)',
        border: `2px solid ${color}`,
        flexShrink: 0,
        transition: 'background 0.15s',
      }} />
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      {label}
    </label>
  );
}

function NodeDetailPanel({ detail }: { detail: NodeDetail }) {
  const color = NODE_COLORS[detail.type] ?? '#888';
  const typeLabel = TYPE_LABELS[detail.type] ?? detail.type;

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* Type badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 20,
        background: hexToRgba(color, 0.18),
        border: `1px solid ${hexToRgba(color, 0.35)}`,
        marginBottom: 12,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color }}>
          {typeLabel}
        </span>
      </div>

      {/* Label */}
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 10px', lineHeight: 1.35, paddingRight: 32 }}>
        {detail.label}
      </h3>

      {/* Description */}
      {detail.description && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: '0 0 20px' }}>
          {detail.description}
        </p>
      )}

      {/* Edge count */}
      <div style={{
        display: 'flex', gap: 20, padding: '10px 12px',
        background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 20,
      }}>
        <Stat label="Connections" value={detail.edge_count} />
        {detail.linked_articles.length > 0 && (
          <Stat label="Articles" value={detail.linked_articles.length} />
        )}
        {detail.children.length > 0 && (
          <Stat label="Sub-concepts" value={detail.children.length} />
        )}
      </div>

      {/* Linked articles */}
      {detail.linked_articles.length > 0 && (
        <Section title="Appears In">
          {detail.linked_articles.map(a => (
            <ArticleLink key={a.id} article={a} />
          ))}
        </Section>
      )}

      {/* Sub-concepts */}
      {detail.children.length > 0 && (
        <Section title="Sub-concepts">
          {detail.children.map(c => (
            <NeighborChip key={c.id} node={c} />
          ))}
        </Section>
      )}

      {/* Related nodes */}
      {detail.neighbors.filter(n => n.type !== 'article').length > 0 && (
        <Section title="Related">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {detail.neighbors
              .filter(n => n.type !== 'article')
              .slice(0, 12)
              .map(n => <NeighborChip key={n.id} node={n} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function ArticleLink({ article }: { article: LinkedArticle }) {
  const formatted = article.publish_date
    ? new Date(article.publish_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <a
      href={article.substack_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '8px 10px',
        borderRadius: 6,
        background: 'rgba(86,161,210,0.08)',
        border: '1px solid rgba(86,161,210,0.15)',
        textDecoration: 'none',
        marginBottom: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#56a1d2', lineHeight: 1.35 }}>
        {article.title}
      </div>
      {formatted && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
          {formatted}
        </div>
      )}
    </a>
  );
}

function NeighborChip({ node }: { node: GraphNodeSummary }) {
  const color = NODE_COLORS[node.type] ?? '#888';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      background: hexToRgba(color, 0.12),
      border: `1px solid ${hexToRgba(color, 0.25)}`,
      fontSize: 12,
      color: hexToRgba(color, 0.9),
      marginBottom: 6,
    }}>
      {node.label}
    </span>
  );
}
