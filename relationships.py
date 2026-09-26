"""
relationships.py -- Echoes of Haven
Per-(NPC, player) trust scores, clamped to [-100, 100].
"""

from db import get_connection

# Default starting trust per NPC (overridden by seed_data.py at runtime)
_DEFAULTS: dict = {
    "mira":  10,
    "rowan": -10,
    "aldric": 0,
    "elian":  0,
}

_CLAMP_MIN, _CLAMP_MAX = -100, 100


def _init(conn) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS relationships (
            npc_id    TEXT NOT NULL,
            player_id TEXT NOT NULL,
            trust     INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (npc_id, player_id)
        )
    """)
    conn.commit()


def _ensure(conn, npc_id: str, player_id: str) -> None:
    """Insert a row with the NPC default trust if one does not exist."""
    default = _DEFAULTS.get(npc_id.lower(), 0)
    conn.execute(
        "INSERT OR IGNORE INTO relationships (npc_id, player_id, trust) VALUES (?, ?, ?)",
        (npc_id, player_id, default),
    )
    conn.commit()


def get_relationship(npc_id: str, player_id: str) -> int:
    """Return current trust score. Defaults to the NPC seed value (or 0)."""
    with get_connection() as conn:
        _init(conn)
        _ensure(conn, npc_id, player_id)
        row = conn.execute(
            "SELECT trust FROM relationships WHERE npc_id=? AND player_id=?",
            (npc_id, player_id),
        ).fetchone()
    return row["trust"] if row else _DEFAULTS.get(npc_id.lower(), 0)


def update_relationship(npc_id: str, player_id: str, delta: int) -> int:
    """
    Apply `delta` to the trust score, clamped to [-100, 100].
    Returns the new score.
    """
    with get_connection() as conn:
        _init(conn)
        _ensure(conn, npc_id, player_id)
        current = conn.execute(
            "SELECT trust FROM relationships WHERE npc_id=? AND player_id=?",
            (npc_id, player_id),
        ).fetchone()["trust"]

        new_score = max(_CLAMP_MIN, min(_CLAMP_MAX, current + delta))
        conn.execute(
            "UPDATE relationships SET trust=? WHERE npc_id=? AND player_id=?",
            (new_score, npc_id, player_id),
        )
        conn.commit()
    return new_score


def seed_relationship(npc_id: str, player_id: str, trust: int) -> None:
    """Upsert a specific trust value — used by seed_data.py."""
    clamped = max(_CLAMP_MIN, min(_CLAMP_MAX, trust))
    with get_connection() as conn:
        _init(conn)
        conn.execute(
            "INSERT INTO relationships (npc_id, player_id, trust) VALUES (?, ?, ?) "
            "ON CONFLICT(npc_id, player_id) DO UPDATE SET trust=excluded.trust",
            (npc_id, player_id, clamped),
        )
        conn.commit()
