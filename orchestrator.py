"""
orchestrator.py -- Echoes of Haven  (Member 2)
================================================
The /talk flow and gossip logic.

INTEGRATION STATUS
------------------
[DONE]  Member 4 -- memory_store, relationships, game_state, actions (real)
[STUB]  Member 3 -- generate_npc_reply, decide_gossip  (swap when ready)

To wire in Member 3's real dialogue module, update the Member 3 import block
below and remove the stubs import for those two functions.
"""

from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Integration imports  <-- SWAP THESE as real modules land
# ---------------------------------------------------------------------------
# Currently: ALL functions come from stubs.py
# Phase 2  : Replace Member 4 stubs with real imports (see guide above)
# Phase 3  : Replace Member 3 stub with real dialogue module

# Member 4 -- REAL implementations (memory / game state)
from memory_store  import get_relevant_memories, add_memory
from relationships import get_relationship
from game_state    import get_inventory
from actions       import execute_action

# Member 3 -- STUB (swap with real dialogue module when Member 3 delivers)
# To swap: replace these two lines with:  from dialogue import generate_npc_reply, decide_gossip
from stubs import generate_npc_reply, decide_gossip

# ---------------------------------------------------------------------------
# Gossip routing table (rule-based)
# Mira (protective, chatty) -> Rowan
# Rowan (authority, duty)   -> Mira
# Aldric & Elian don't gossip by default (private types)
# ---------------------------------------------------------------------------
_GOSSIP_ROUTES: dict = {
    "mira":  "rowan",
    "rowan": "mira",
}


# ---------------------------------------------------------------------------
# Main orchestration flow
# ---------------------------------------------------------------------------

def run_talk_flow(npc_id: str, player_id: str, message: str) -> dict:
    """
    Execute the full /talk pipeline and return the shaped API response dict.

    Steps:
        a. Fetch relevant memories
        b. Fetch trust score
        c. Generate NPC reply (dialogue + optional action)
        d. Execute action if present
        e. Log new memory
        f. Run gossip logic
        g. Build and return response
    """

    # -- a. Fetch relevant memories ------------------------------------------
    memory_context: list = get_relevant_memories(
        npc_id=npc_id,
        player_id=player_id,
        query=message,
        limit=5,
    )
    logger.debug("memories for %s/%s: %s", npc_id, player_id, memory_context)

    # -- b. Fetch trust score ------------------------------------------------
    trust_score: int = get_relationship(npc_id=npc_id, player_id=player_id)
    logger.debug("trust %s->%s: %d", npc_id, player_id, trust_score)

    # -- c. Generate NPC reply -----------------------------------------------
    reply: dict = generate_npc_reply(
        npc_id=npc_id,
        player_message=message,
        memory_context=memory_context,
        trust_score=trust_score,
    )
    dialogue: str       = reply.get("dialogue", "")
    action_dict         = reply.get("action")   # dict or None

    # -- d. Execute action (if any) ------------------------------------------
    action_result = None
    if action_dict:
        try:
            action_result = execute_action(action_dict)
            logger.info("action executed: %s", action_result)
        except Exception as exc:
            logger.warning("execute_action failed: %s", exc)
            action_result = {"action": action_dict.get("action"), "success": False, "reason": str(exc)}

    # -- e. Log new memory ---------------------------------------------------
    new_memory_entry = {
        "type":         _classify_memory_type(message),
        "content":      message,
        "about_player": player_id,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "shared_with":  [],
    }
    try:
        add_memory(npc_id=npc_id, entry=new_memory_entry)
    except Exception as exc:
        logger.warning("add_memory failed: %s", exc)

    # -- f. Gossip logic -----------------------------------------------------
    gossip_event: str | None = decide_and_relay_gossip(
        npc_id=npc_id,
        memory_entry=new_memory_entry,
        player_id=player_id,
    )

    # -- g. Build response ---------------------------------------------------
    try:
        inventory_snapshot: dict = get_inventory(player_id)
    except Exception as exc:
        logger.warning("get_inventory failed: %s", exc)
        inventory_snapshot = {}

    return {
        "npc_id":             npc_id,
        "dialogue":           dialogue,
        "trust_score":        trust_score,
        "action_result":      action_result,
        "inventory_snapshot": inventory_snapshot,
        "gossip_event":       gossip_event,
    }


# ---------------------------------------------------------------------------
# Gossip logic
# ---------------------------------------------------------------------------

def decide_and_relay_gossip(
    npc_id: str,
    memory_entry: dict,
    player_id: str,
) -> str | None:
    """
    Decide if npc_id should gossip to another NPC about memory_entry.

    Rule-based logic (fast, no LLM):
      - Only 'secret'-type memories trigger gossip.
      - Only Mira and Rowan gossip (protective NPCs).
      - Gossip target is determined by _GOSSIP_ROUTES.

    Optionally calls decide_gossip() from Member 3 for an LLM override.
    If that returns a non-None string (recipient NPC id), that overrides the route.

    Returns a human-readable gossip_event string, or None.
    """
    mem_type    = memory_entry.get("type", "")
    mem_content = memory_entry.get("content", "")

    if mem_type != "secret":
        return None

    # Try LLM-based gossip decision from Member 3 (stub returns None for now)
    try:
        llm_recipient = decide_gossip(npc_id, memory_entry)
    except Exception:
        llm_recipient = None

    recipient_npc = llm_recipient or _GOSSIP_ROUTES.get(npc_id.lower())

    if not recipient_npc:
        return None  # NPC is not in the gossip network

    # Build the shared memory entry for the recipient
    shared_entry = {
        "type":         "secret",
        "content":      f"[Passed on from {npc_id}] {mem_content}",
        "about_player": player_id,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "shared_with":  [npc_id],
    }

    try:
        add_memory(npc_id=recipient_npc, entry=shared_entry)
        logger.info("gossip relayed: %s -> %s", npc_id, recipient_npc)
    except Exception as exc:
        logger.warning("gossip add_memory failed (%s->%s): %s", npc_id, recipient_npc, exc)
        return None

    # Return human-readable gossip event string
    short_content = mem_content[:60] + ("..." if len(mem_content) > 60 else "")
    npc_display   = npc_id.capitalize()
    recv_display  = recipient_npc.capitalize()
    return f"{npc_display} whispered to {recv_display}: \"{short_content}\""


# ---------------------------------------------------------------------------
# Debug state helper
# ---------------------------------------------------------------------------

def get_full_state(player_id: str) -> dict:
    """
    Return a debug snapshot: trust scores for all NPCs + player inventory.
    Used by GET /state/{player_id}.
    """
    npc_ids = ["mira", "rowan", "aldric", "elian"]
    trust_map = {}
    for npc in npc_ids:
        try:
            trust_map[npc] = get_relationship(npc_id=npc, player_id=player_id)
        except Exception as exc:
            trust_map[npc] = f"error: {exc}"

    try:
        inventory = get_inventory(player_id)
    except Exception as exc:
        inventory = {"error": str(exc)}

    return {
        "player_id":   player_id,
        "trust_scores": trust_map,
        "inventory":   inventory,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _classify_memory_type(message: str) -> str:
    """
    Heuristically classify a player message as fact/secret/promise/event.
    Good enough for hackathon; Member 3 can upgrade this with an LLM call.
    """
    msg_lower = message.lower()
    secret_kw  = {"secret", "forbidden", "forest", "tonight", "private", "tell no one", "don't tell", "swear", "promise me"}
    promise_kw = {"i will", "i'll", "i promise", "i swear", "i vow"}
    event_kw   = {"happened", "attacked", "found", "saw", "witnessed", "just", "ago"}

    if any(kw in msg_lower for kw in secret_kw):
        return "secret"
    if any(kw in msg_lower for kw in promise_kw):
        return "promise"
    if any(kw in msg_lower for kw in event_kw):
        return "event"
    return "fact"
