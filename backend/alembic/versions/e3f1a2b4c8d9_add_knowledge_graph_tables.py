"""add knowledge graph tables

Revision ID: e3f1a2b4c8d9
Revises: a1b2c3d4e5f6
Create Date: 2026-04-18 00:00:00.000000

Creates graph_nodes, graph_edges, graph_merge_candidates.
Enables the pgvector extension on PostgreSQL and adds a vector index
for fast cosine-similarity deduplication.

The vector extension step is skipped silently on SQLite (local dev / tests).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import Inspector

# revision identifiers
revision = "e3f1a2b4c8d9"
down_revision = "a782dddf5630"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    # Enable pgvector on PostgreSQL (one-time per DB, safe to re-run)
    if _is_postgres():
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "graph_nodes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("label", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("external_id", sa.String(36), nullable=True),
        sa.Column("external_table", sa.String(64), nullable=True),
        # Stored as JSON text; PostgreSQL gets a vector index below
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.Column("properties", sa.JSON(), nullable=True),
        sa.Column("edge_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("parent_id", sa.String(36), sa.ForeignKey("graph_nodes.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_graph_nodes_external", "graph_nodes", ["external_table", "external_id"])
    op.create_index("ix_graph_nodes_type_edge_count", "graph_nodes", ["type", "edge_count"])

    # PostgreSQL: create a functional expression index so cosine distance queries
    # on (embedding::vector) are fast.  Requires pgvector >= 0.5 and PostgreSQL 12+.
    # At small scale (< 1000 nodes) this is a nice-to-have; the inline ::vector cast
    # works without it.  Wrapped in try/except so local dev without pgvector degrades
    # gracefully — the application layer already handles this path.
    if _is_postgres():
        try:
            op.execute(
                """
                CREATE INDEX ix_graph_nodes_embedding_cosine
                ON graph_nodes
                USING ivfflat ((embedding::vector(768)) vector_cosine_ops)
                WHERE embedding IS NOT NULL
                """
            )
        except Exception:
            pass  # pgvector not installed or version too old — skip index

    op.create_table(
        "graph_edges",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "source_id",
            sa.String(36),
            sa.ForeignKey("graph_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            sa.String(36),
            sa.ForeignKey("graph_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("edge_type", sa.String(64), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("source_id", "target_id", "edge_type", name="uq_graph_edges"),
    )
    op.create_index("ix_graph_edges_source", "graph_edges", ["source_id"])
    op.create_index("ix_graph_edges_target", "graph_edges", ["target_id"])

    op.create_table(
        "graph_merge_candidates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "node_a_id",
            sa.String(36),
            sa.ForeignKey("graph_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "node_b_id",
            sa.String(36),
            sa.ForeignKey("graph_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("similarity", sa.Float(), nullable=False),
        sa.Column("source", sa.String(32), nullable=False, server_default="ingestion"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_graph_merge_candidates_status",
        "graph_merge_candidates",
        ["status", "similarity"],
    )


def downgrade() -> None:
    op.drop_table("graph_merge_candidates")
    op.drop_table("graph_edges")
    if _is_postgres():
        op.execute("DROP INDEX IF EXISTS ix_graph_nodes_embedding_cosine")
    op.drop_table("graph_nodes")
