"""
stubs.py -- Echoes of Haven  (Member 2)
========================================
Placeholder implementations of the cross-member integration contract.

IMPORTANT: These stubs are the ONLY place that needs to change as real
modules become available:

  Member 4 functions  (memory / game state):
      get_relevant_memories, get_relationship, add_memory, get_inventory,
      execute_action

  Member 3 functions  (AI / dialogue engine):
      generate_npc_reply, decide_gossip

To wire in Member 4's real module, replace this block at the top of
orchestrator.py:

    from stubs import (
        get_relevant_memories, get_relationship,
        add_memory, get_inventory, execute_action,
        generate_npc_reply, decide_gossip,
    )

with the real imports, e.g.:

    from memory_store  import get_relevant_memories, add_memory
    from relationships import get_relationship
    from game_state    import get_inventory
    from actions       import execute_action
    from dialogue      import generate_npc_reply, decide_gossip   # Member 3

Each stub returns correctly shaped fake-but-realistic data so the API is
fully callable and testable before any teammate code lands.
"""

from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Member 4 stubs  (memory / game state)
# ---------------------------------------------------------------------------

def get_relevant_memories(npc_id: str, player_id: str, query: str = "", limit: int = 5) -> list:
    """
    STUB -- owned by Member 4 (memory_store.py).
    Real signature: get_relevant_memories(npc_id, player_id, query, limit) -> list[str]
    """
    return [
        f"[stub] {npc_id} remembers: player asked about '{query[:30]}' before.",
        f"[stub] {npc_id} trusts the player somewhat -- they shared a rumour earlier.",
    ]


def get_relationship(npc_id: str, player_id: str) -> int:
    """
    STUB -- owned by Member 4 (relationships.py).
    Real signature: get_relationship(npc_id, player_id) -> int  (trust in [-100, 100])
    """
    defaults = {"mira": 10, "rowan": -10, "aldric": 0, "elian": 0}
    return defaults.get(npc_id.lower(), 0)


def add_memory(npc_id: str, entry: dict) -> None:
    """
    STUB -- owned by Member 4 (memory_store.py).
    Real signature: add_memory(npc_id, entry: dict) -> None
    entry shape: { type, content, about_player, timestamp, shared_with }
    """
    print(f"[stub:add_memory] {npc_id} <- {entry.get('type','?')}: {entry.get('content','')[:60]}")


def get_inventory(owner_id: str) -> dict:
    """
    STUB -- owned by Member 4 (game_state.py).
    Real signature: get_inventory(owner_id) -> dict  e.g. {"gold": 100, "torch": 1}
    """
    defaults = {
        "player": {"gold": 100, "torch": 1, "potion": 2},
        "mira":   {"gold": 85, "ale": 8, "bread": 6},
        "rowan":  {"gold": 120, "iron_sword": 1, "shield": 1},
        "aldric": {"gold": 240, "iron": 8, "steel": 3, "sword": 2},
        "elian":  {"gold": 60, "spell_scroll": 3, "barrier_shard": 1},
    }
    return defaults.get(owner_id.lower(), {"gold": 50})


def execute_action(action: dict) -> dict:
    """
    STUB -- owned by Member 4 (actions.py).
    Real signature: execute_action(action: dict) -> dict
    Returns: { action, success, reason, ... }
    """
    action_type = action.get("action", "unknown")
    item        = action.get("item", "unknown_item")
    print(f"[stub:execute_action] {action_type} -> item={item}")
    return {
        "action":  action_type,
        "success": True,
        "item":    item,
        "reason":  "[stub] Action simulated successfully.",
    }


# ---------------------------------------------------------------------------
# Member 3 stubs  (AI / dialogue engine)
# ---------------------------------------------------------------------------

def generate_npc_reply(
    npc_id: str,
    player_message: str,
    memory_context: list,
    trust_score: int,
) -> dict:
    """
    STUB -- owned by Member 3 (dialogue engine).
    Real signature:
        generate_npc_reply(npc_id, player_message, memory_context, trust_score)
        -> { "dialogue": str, "action": dict | None }

    The real version makes an LLM call with the NPC persona system prompt,
    injected memories, and trust-gated tone, and may return a tool-call action.
    """
    persona_lines = {
        "mira":   "Mira wipes the counter and leans in conspiratorially.",
        "rowan":  "Rowan crosses his arms, eyes narrowing.",
        "aldric": "Aldric sets down his hammer with a clang.",
        "elian":  "Elian looks up from a glowing tome, eyebrows raised.",
    }
    intro = persona_lines.get(npc_id.lower(), f"{npc_id.capitalize()} pauses.")

    tone = "warmly" if trust_score > 20 else ("cautiously" if trust_score >= 0 else "with suspicion")
    dialogue = (
        f"{intro} \"{player_message[:40]}{'...' if len(player_message)>40 else ''}\" "
        f"-- {npc_id.capitalize()} responds {tone}: [stub dialogue -- Member 3 will replace this]"
    )

    # Simulate a give_item action when trust is positive and message mentions torch
    stub_action = None
    if trust_score >= 10 and "torch" in player_message.lower():
        stub_action = {
            "action": "give_item",
            "actor":  npc_id,
            "target": "player",
            "item":   "torch",
            "quantity": 1,
        }

    return {"dialogue": dialogue, "action": stub_action}


def decide_gossip(npc_id: str, memory_entry: dict):
    """
    STUB -- owned by Member 3 (optional LLM-based upgrade).
    Real signature: decide_gossip(npc_id, memory_entry) -> str | None

    The real version makes a lightweight LLM call: "Should you tell someone
    this, and who?"  The stub always returns None so gossip falls back to
    orchestrator.py's rule-based decide_and_relay_gossip().
    """
    return None  # Let the rule-based gossip logic in orchestrator.py handle it
