"""Pydantic schemas for knowledge graph API."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Node schemas
# ---------------------------------------------------------------------------

class GraphNodeBase(BaseModel):
    id: str
    type: str
    label: str
    description: str | None = None
    properties: Any | None = None
    edge_count: int = 0
    last_activity_at: datetime | None = None
    parent_id: str | None = None

    model_config = {"from_attributes": True}


class GraphNodeSummary(GraphNodeBase):
    """Lightweight node for graph visualisation payload."""
    pass


class GraphEdgeSummary(BaseModel):
    """Edge for graph visualisation payload.

    Field names 'source'/'target' are required by react-force-graph-2d.
    """
    source: str
    target: str
    edge_type: str
    weight: float

    model_config = {"from_attributes": True}


class GraphResponse(BaseModel):
    """Full graph payload for the /graph endpoint."""
    nodes: list[GraphNodeSummary]
    edges: list[GraphEdgeSummary]


class LinkedArticle(BaseModel):
    id: str
    title: str
    chapter_id: str
    publish_date: Any | None = None
    substack_url: str | None = None

    model_config = {"from_attributes": True}


class GraphNodeDetail(GraphNodeBase):
    """Full node detail for the click-to-sidebar panel."""
    neighbors: list[GraphNodeSummary] = []
    linked_articles: list[LinkedArticle] = []
    children: list[GraphNodeSummary] = []


# ---------------------------------------------------------------------------
# Merge candidate schemas
# ---------------------------------------------------------------------------

class MergeCandidateResponse(BaseModel):
    id: str
    node_a: GraphNodeSummary
    node_b: GraphNodeSummary
    similarity: float
    source: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MergeRequest(BaseModel):
    keep_id: str
    discard_id: str


class NodeEditRequest(BaseModel):
    label: str | None = None
    description: str | None = None


# ---------------------------------------------------------------------------
# Backfill schemas
# ---------------------------------------------------------------------------

class BackfillStatus(BaseModel):
    processed: int
    total: int
    complete: bool
