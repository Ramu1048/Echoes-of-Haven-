"""
memory_store.py -- Echoes of Haven
Per-NPC memory entries: facts, secrets, promises, events.
"""

import sqlite3
import json
from datetime import datetime, timezone
from db import get_connection


# ---------------------------------------------------------------------------
# Schema bootstrap
# ---------------------------------------------------------------------------

def _init(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            npc_id      TEXT NOT NULL,
            player_id   TEXT NOT NULL,
            type        TEXT NOT NULL CHECK(type IN ('fact','secret','promise','event')),
            content     TEXT NOT NULL,
            timestamp   TEXT NOT NULL,
            shared_with TEXT NOT NULL DEFAULT '[]'
        )
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def add_memory(npc_id: str, entry: dict) -> None:
    """
    Store a new memory entry for an NPC.

    entry shape:
        {
            "type":         "fact | secret | promise | event",
            "content":      "...",
            "about_player": "ramu",
            "timestamp":    "ISO datetime",   # auto-generated if omitted
            "shared_with":  ["rowan"]         # defaults to []
        }
    """
    player_id   = entry.get("about_player", "unknown")
    mem_type    = entry.get("type", "fact")
    content     = entry.get("content", "")
    timestamp   = entry.get("timestamp") or datetime.now(timezone.utc).isoformat()
    shared_with = json.dumps(entry.get("shared_with", []))

    with get_connection() as conn:
        _init(conn)
        conn.execute(
            "INSERT INTO memories (npc_id, player_id, type, content, timestamp, shared_with) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (npc_id, player_id, mem_type, content, timestamp, shared_with),
        )
        conn.commit()


def get_relevant_memories(
    npc_id: str,
    player_id: str,
    query: str = "",
    limit: int = 5,
) -> list:
    """
    Return up to `limit` memory content strings for the given NPC + player.

    Strategy (recency + keyword overlap, no embeddings):
      1. Pull all memories for (npc_id, player_id), newest first.
      2. Secrets are hidden unless the query explicitly overlaps their content.
      3. Rank by keyword overlap score, then by recency.
      4. Return top `limit` content strings.
    """
    with get_connection() as conn:
        _init(conn)
        rows = conn.execute(
            "SELECT type, content FROM memories "
            "WHERE npc_id=? AND player_id=? ORDER BY id DESC",
            (npc_id, player_id),
        ).fetchall()

    if not rows:
        return []

    qkw = _keywords(query)

    def score(row):
        mem_type, content = row["type"], row["content"]
        if mem_type == "secret":
            if not qkw:
                return -1                     # never surface without a query
            overlap = qkw & _keywords(content)
            return (len(overlap) + 10) if overlap else -1
        return len(qkw & _keywords(content)) if qkw else 0

    ranked = sorted(rows, key=score, reverse=True)
    return [r["content"] for r in ranked if score(r) >= 0][:limit]


def get_all_memories(npc_id: str, player_id: str) -> list:
    """Return every raw memory entry for debugging."""
    with get_connection() as conn:
        _init(conn)
        rows = conn.execute(
            "SELECT npc_id, player_id, type, content, timestamp, shared_with "
            "FROM memories WHERE npc_id=? AND player_id=? ORDER BY id ASC",
            (npc_id, player_id),
        ).fetchall()

    return [
        {
            "npc_id":       r["npc_id"],
            "about_player": r["player_id"],
            "type":         r["type"],
            "content":      r["content"],
            "timestamp":    r["timestamp"],
            "shared_with":  json.loads(r["shared_with"]),
        }
        for r in rows
    ]


def mark_shared(npc_id: str, player_id: str, content: str, shared_with_npc: str) -> None:
    """
    Append shared_with_npc to the shared_with list of a memory.
    Called by gossip logic after a memory is propagated to another NPC.
    """
    with get_connection() as conn:
        _init(conn)
        row = conn.execute(
            "SELECT id, shared_with FROM memories "
            "WHERE npc_id=? AND player_id=? AND content=? ORDER BY id DESC LIMIT 1",
            (npc_id, player_id, content),
        ).fetchone()
        if row:
            current: list = json.loads(row["shared_with"])
            if shared_with_npc not in current:
                current.append(shared_with_npc)
            conn.execute(
                "UPDATE memories SET shared_with=? WHERE id=?",
                (json.dumps(current), row["id"]),
            )
            conn.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STOPWORDS = {"the","and","for","are","was","that","with","have","from","this","will","into","been","they","their"}

def _keywords(text: str) -> set:
    return {
        w.lower().strip(".,!?\"'")
        for w in text.split()
        if len(w) > 3 and w.lower() not in _STOPWORDS
    }
