"""Guard against parallel branches each adding a migration off the same parent."""
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_has_a_single_head():
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    heads = ScriptDirectory.from_config(cfg).get_heads()
    assert len(heads) == 1, (
        f"Multiple alembic heads {heads}: the container's `alembic upgrade head` will fail. "
        "Add a merge migration (`alembic merge <heads>`)."
    )
