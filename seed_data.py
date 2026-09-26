"""
seed_data.py -- Echoes of Haven
Initialize the database with starting inventories, trust scores,
and each NPC s private lore secrets.

Run once:  python seed_data.py
Re-seeding is safe (upserts, does not duplicate data).
"""

import os
from datetime import datetime, timezone

from db import get_connection
from game_state import seed_inventory
from relationships import seed_relationship
from memory_store import add_memory, get_all_memories


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _secret(npc_id: str, content: str, player_id: str = "__world__") -> dict:
    """Build a seeded secret memory entry."""
    return {
        "type":         "secret",
        "content":      content,
        "about_player": player_id,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "shared_with":  [],
    }


def _already_seeded(npc_id: str) -> bool:
    """Return True if this NPC already has world-secret memories (avoid duplicates)."""
    from db import get_connection as gc
    from memory_store import _init as _init_mem
    conn = gc()
    _init_mem(conn)
    row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM memories WHERE npc_id=? AND player_id='__world__'",
        (npc_id,),
    ).fetchone()
    conn.close()
    return (row["cnt"] if row else 0) > 0


# -----------------------------------------------------------------------
# Seed Functions
# -----------------------------------------------------------------------

def seed_inventories(player_id: str = "player") -> None:
    print("Seeding inventories...")

    # Player
    seed_inventory(player_id, {
        "gold":   100,
        "torch":    1,
        "potion":   2,
    })

    # Mira (Tavern Keeper) — warmth and supply
    seed_inventory("mira", {
        "gold":       85,
        "ale":         8,
        "bread":       6,
        "candle":      4,
        "room_key":    2,
        "healing_herb": 1,
    })

    # Rowan (Guard Captain) — weapons and authority
    seed_inventory("rowan", {
        "gold":       120,
        "iron_sword":   1,
        "shield":       1,
        "torch":        3,
        "handcuffs":    1,
        "guard_badge":  1,
    })

    # Aldric (Blacksmith) — raw materials and tools
    seed_inventory("aldric", {
        "gold":   240,
        "iron":     8,
        "steel":    3,
        "sword":    2,
        "hammer":   1,
        "wood":     5,
        "herbs":    2,
    })

    # Elian (Mage) — arcane components
    seed_inventory("elian", {
        "gold":        60,
        "spell_scroll": 3,
        "barrier_shard": 1,
        "herbs":         4,
        "candle":        5,
        "old_tome":      1,
    })

    print("  Inventories seeded.")


def seed_relationships(player_id: str = "player") -> None:
    print(f"Seeding trust scores for player '{player_id}'...")
    seed_relationship("mira",   player_id,  10)
    seed_relationship("rowan",  player_id, -10)
    seed_relationship("aldric", player_id,   0)
    seed_relationship("elian",  player_id,   0)
    print(f"  Trust scores seeded: mira=+10, rowan=-10, aldric=0, elian=0")


def seed_npc_secrets() -> None:
    """
    Pre-load private lore for each NPC as type=secret memories
    keyed to player_id='__world__' so they are world-knowledge, not
    player-shared facts.  get_relevant_memories only surfaces them
    when the player s query overlaps with the secret content.
    """
    print("Seeding NPC private lore...")

    secrets = {
        "mira": [
            "Someone has been stealing village supplies from the cellar every new moon.",
            "Three weeks ago, a traveler paid with a coin I have never seen before — engraved with the barrier rune.",
            "I overheard Rowan arguing with a hooded figure near the well past midnight last week.",
            "The old innkeeper who trained me warned that Haven was built above something that must never wake.",
        ],
        "aldric": [
            "My father disappeared into the Forbidden Forest fifteen years ago and was never found.",
            "I found his hammer last winter near the forest edge — with a fresh barrier rune carved into the handle.",
            "I have been secretly reinforcing the barrier ward-stones at night, but they keep crumbling by morning.",
            "There is a hidden forge room beneath my smithy where my father taught me the old binding craft.",
        ],
        "rowan": [
            "Someone has been entering the village at night through a passage that should not exist.",
            "I have found three guardsmen asleep at their posts with no memory of the last hour — something compelled them.",
            "The patrol logs show the barrier weakens precisely at the third hour after midnight.",
            "I suspect one of the four prominent villagers is knowingly letting something through — I have no proof yet.",
        ],
        "elian": [
            "The barrier is failing, and I do not yet know why — every diagnosis spell returns contradictory results.",
            "The barrier was not built to keep things out — it was built to keep something sealed inside.",
            "My master s final letter warned me never to use the full unbinding spell, no matter who asks.",
            "I have found a resonance pattern in the barrier decay that matches an old pre-Haven incantation — one that requires a willing sacrifice.",
        ],
    }

    for npc_id, lore_list in secrets.items():
        if _already_seeded(npc_id):
            print(f"  {npc_id}: secrets already seeded, skipping.")
            continue
        for lore in lore_list:
            add_memory(npc_id, _secret(npc_id, lore))
        print(f"  {npc_id}: {len(lore_list)} secrets seeded.")


# -----------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------

def seed_all(player_id: str = "player") -> None:
    seed_inventories(player_id)
    seed_relationships(player_id)
    seed_npc_secrets()
    print("\nSeed complete. Haven is ready.")


if __name__ == "__main__":
    seed_all()
