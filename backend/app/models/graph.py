"""Knowledge graph models: nodes, edges, merge candidates."""

import uuid
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class GraphNode(Base, TimestampMixin):
    """
    A node in the knowledge graph.

    type='article'  → one per salon session; external_table='articles', external_id=article.id
    type='concept'  → recurring theme or insight cluster; has embedding
    type='question' → open question raised across sessions; has embedding

    New node types (person, book, event, …) require no schema changes —
    just add a new type value and use external_table/external_id + properties.
    """

    __tablename__ = "graph_nodes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Generic external reference — replaces type-specific FK columns
    external_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    external_table: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Stored as JSON string so model works with both SQLite and PostgreSQL.
    # PostgreSQL migration adds a vector index separately via raw SQL.
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Type-specific metadata: publish_date for articles, color for tags, etc.
    properties: Mapped[Any | None] = mapped_column(JSON, nullable=True, default=dict)

    # Denormalized counts updated whenever edges are added/removed
    edge_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_at: Mapped[Any | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Nullable self-reference for concept hierarchy (parent concept → child concept)
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("graph_nodes.id"), nullable=True
    )

    parent: Mapped["GraphNode | None"] = relationship(
        "GraphNode",
        remote_side="GraphNode.id",
        back_populates="children",
        foreign_keys="GraphNode.parent_id",
    )
    children: Mapped[list["GraphNode"]] = relationship(
        "GraphNode",
        back_populates="parent",
        foreign_keys="GraphNode.parent_id",
    )
    outgoing_edges: Mapped[list["GraphEdge"]] = relationship(
        "GraphEdge",
        foreign_keys="GraphEdge.source_id",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[list["GraphEdge"]] = relationship(
        "GraphEdge",
        foreign_keys="GraphEdge.target_id",
        back_populates="target",
        cascade="all, delete-orphan",
    )


class GraphEdge(Base):
    """Directed edge between two graph nodes."""

    __tablename__ = "graph_edges"
    __table_args__ = (
        UniqueConstraint("source_id", "target_id", "edge_type", name="uq_graph_edges"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Open string — new edge types need no schema change
    edge_type: Mapped[str] = mapped_column(String(64), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    created_at: Mapped[Any] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )

    source: Mapped["GraphNode"] = relationship(
        "GraphNode", foreign_keys=[source_id], back_populates="outgoing_edges"
    )
    target: Mapped["GraphNode"] = relationship(
        "GraphNode", foreign_keys=[target_id], back_populates="incoming_edges"
    )


class GraphMergeCandidate(Base):
    """
    Candidate pair of nodes that may refer to the same concept/question.

    source='ingestion' — produced during normal article processing
    source='backfill'  — produced during the one-time backfill run;
                         requires admin review before any auto-merge fires
    """

    __tablename__ = "graph_merge_candidates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    node_a_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False
    )
    node_b_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False
    )
    similarity: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="ingestion")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")

    created_at: Mapped[Any] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )

    node_a: Mapped["GraphNode"] = relationship("GraphNode", foreign_keys=[node_a_id])
    node_b: Mapped["GraphNode"] = relationship("GraphNode", foreign_keys=[node_b_id])
