"""
game_state.py -- Echoes of Haven
Player + NPC inventories, and active quest tracking.
"""

import json
from datetime import datetime, timezone
from db import get_connection


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

def _init(conn) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inventories (
            owner_id TEXT    NOT NULL,
            item     TEXT    NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (owner_id, item)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS quests (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT    NOT NULL,
            name      TEXT    NOT NULL,
            objective TEXT    NOT NULL,
            giver     TEXT    NOT NULL,
            status    TEXT    NOT NULL DEFAULT 'active',
            started   TEXT    NOT NULL
        )
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

def get_inventory(owner_id: str) -> dict:
    """Return the full inventory dict for a player or NPC."""
    with get_connection() as conn:
        _init(conn)
        rows = conn.execute(
            "SELECT item, quantity FROM inventories WHERE owner_id=? AND quantity > 0",
            (owner_id,),
        ).fetchall()
    return {r["item"]: r["quantity"] for r in rows}


def modify_inventory(owner_id: str, item: str, delta: int) -> dict:
    """
    Add or remove `delta` units of `item` for `owner_id`.
    Quantity never goes below 0.
    Returns the updated full inventory.
    Raises ValueError if the operation would result in negative stock.
    """
    with get_connection() as conn:
        _init(conn)
        row = conn.execute(
            "SELECT quantity FROM inventories WHERE owner_id=? AND item=?",
            (owner_id, item),
        ).fetchone()
        current = row["quantity"] if row else 0
        new_qty = current + delta

        if new_qty < 0:
            raise ValueError(
                f"{owner_id} only has {current} {item} — cannot remove {abs(delta)}"
            )

        if row:
            conn.execute(
                "UPDATE inventories SET quantity=? WHERE owner_id=? AND item=?",
                (new_qty, owner_id, item),
            )
        else:
            conn.execute(
                "INSERT INTO inventories (owner_id, item, quantity) VALUES (?, ?, ?)",
                (owner_id, item, new_qty),
            )
        conn.commit()

    return get_inventory(owner_id)


def seed_inventory(owner_id: str, items: dict) -> None:
    """Upsert an initial inventory — used by seed_data.py."""
    with get_connection() as conn:
        _init(conn)
        for item, qty in items.items():
            conn.execute(
                "INSERT INTO inventories (owner_id, item, quantity) VALUES (?, ?, ?) "
                "ON CONFLICT(owner_id, item) DO UPDATE SET quantity=excluded.quantity",
                (owner_id, item, qty),
            )
        conn.commit()


# ---------------------------------------------------------------------------
# Quests
# ---------------------------------------------------------------------------

def start_quest(player_id: str, quest_name: str, objective: str, giver_npc: str) -> dict:
    """
    Create a new active quest for the player.
    Returns the quest dict.
    """
    started = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        _init(conn)
        cur = conn.execute(
            "INSERT INTO quests (player_id, name, objective, giver, status, started) "
            "VALUES (?, ?, ?, ?, 'active', ?)",
            (player_id, quest_name, objective, giver_npc, started),
        )
        quest_id = cur.lastrowid
        conn.commit()

    return {
        "id":        quest_id,
        "player_id": player_id,
        "name":      quest_name,
        "objective": objective,
        "giver":     giver_npc,
        "status":    "active",
        "started":   started,
    }


def get_active_quests(player_id: str) -> list:
    """Return all active quests for the player."""
    with get_connection() as conn:
        _init(conn)
        rows = conn.execute(
            "SELECT id, player_id, name, objective, giver, status, started "
            "FROM quests WHERE player_id=? AND status='active' ORDER BY id ASC",
            (player_id,),
        ).fetchall()

    return [
        {
            "id":        r["id"],
            "player_id": r["player_id"],
            "name":      r["name"],
            "objective": r["objective"],
            "giver":     r["giver"],
            "status":    r["status"],
            "started":   r["started"],
        }
        for r in rows
    ]


def complete_quest(player_id: str, quest_name: str) -> bool:
    """Mark a quest complete. Returns True if found and updated."""
    with get_connection() as conn:
        _init(conn)
        cur = conn.execute(
            "UPDATE quests SET status='completed' "
            "WHERE player_id=? AND name=? AND status='active'",
            (player_id, quest_name),
        )
        conn.commit()
    return cur.rowcount > 0
