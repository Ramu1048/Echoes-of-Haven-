"""
actions.py -- Echoes of Haven
Action executor: applies LLM-triggered actions to real game state.
"""

from game_state import modify_inventory, start_quest, get_inventory

# ---------------------------------------------------------------------------
# Material requirements for crafting
# ---------------------------------------------------------------------------

CRAFT_RECIPES: dict = {
    "iron_sword":     {"iron": 2},
    "steel_sword":    {"steel": 2},
    "shield":         {"iron": 3},
    "iron_dagger":    {"iron": 1},
    "chainmail":      {"iron": 5, "steel": 1},
    "healing_potion": {"herbs": 2},
    "torch":          {"wood": 1},
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def execute_action(action: dict) -> dict:
    """
    Apply an LLM-triggered action to game state.

    Supported action types:
        craft_item  -- actor consumes materials, target receives item
        give_item   -- actor loses item, target gains it
        take_item   -- target loses item, actor gains it
        start_quest -- create a new quest for target (player)
        move_to     -- stub; records intent, no inventory change

    Returns:
        { "action": str, "success": bool, "reason": str, ... }
    """
    action_type = action.get("action", "")
    actor       = action.get("actor", "")
    target      = action.get("target", "player")

    handlers = {
        "craft_item":  _craft_item,
        "give_item":   _give_item,
        "take_item":   _take_item,
        "start_quest": _start_quest,
        "move_to":     _move_to,
    }

    handler = handlers.get(action_type)
    if not handler:
        return _fail(action_type, f"Unknown action type: '{action_type}'")

    try:
        return handler(action, actor, target)
    except Exception as exc:
        return _fail(action_type, str(exc))


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def _craft_item(action: dict, actor: str, target: str) -> dict:
    item     = str(action.get("item", "")).strip().lower().replace(" ", "_")
    # Allow caller to override material/quantity via action dict
    material = action.get("material")
    if material:
        material = str(material).strip().lower()
    qty      = action.get("quantity", 1)

    recipe = CRAFT_RECIPES.get(item)
    if not recipe and material:
        recipe = {material: 2}
    elif not recipe:
        return _fail("craft_item", f"No known recipe for '{item}'")

    # If caller specified a single material override, use that instead of recipe
    if material:
        recipe = {material: 2}   # sensible default: 2 units per craft

    # Check actor has enough materials
    actor_inv = get_inventory(actor)
    for mat, needed in recipe.items():
        have = actor_inv.get(mat, 0)
        if have < needed:
            return _fail("craft_item", f"Not enough {mat}: {actor} has {have}, needs {needed}")

    # Consume materials from actor
    for mat, needed in recipe.items():
        modify_inventory(actor, mat, -needed)

    # Give crafted item to target
    target_inv = modify_inventory(target, item, qty)

    return {
        "action":           "craft_item",
        "success":          True,
        "item":             item,
        "crafted_by":       actor,
        "given_to":         target,
        "materials_used":   recipe,
        "target_inventory": target_inv,
        "reason":           "",
    }


def _give_item(action: dict, actor: str, target: str) -> dict:
    item = str(action.get("item", "")).strip().lower().replace(" ", "_")
    qty  = action.get("quantity", 1)

    actor_inv = get_inventory(actor)
    if actor_inv.get(item, 0) < qty:
        return _fail(
            "give_item",
            f"{actor} does not have enough {item} (has {actor_inv.get(item, 0)}, needs {qty})",
        )

    modify_inventory(actor, item, -qty)
    target_inv = modify_inventory(target, item, qty)

    return {
        "action":           "give_item",
        "success":          True,
        "item":             item,
        "quantity":         qty,
        "from":             actor,
        "to":               target,
        "target_inventory": target_inv,
        "reason":           "",
    }


def _take_item(action: dict, actor: str, target: str) -> dict:
    item = str(action.get("item", "")).strip().lower().replace(" ", "_")
    qty  = action.get("quantity", 1)

    target_inv_pre = get_inventory(target)
    if target_inv_pre.get(item, 0) < qty:
        return _fail(
            "take_item",
            f"{target} does not have enough {item} (has {target_inv_pre.get(item, 0)}, needs {qty})",
        )

    modify_inventory(target, item, -qty)
    actor_inv = modify_inventory(actor, item, qty)

    return {
        "action":          "take_item",
        "success":         True,
        "item":            item,
        "quantity":        qty,
        "from":            target,
        "to":              actor,
        "actor_inventory": actor_inv,
        "reason":          "",
    }


def _start_quest(action: dict, actor: str, target: str) -> dict:
    quest_name = action.get("quest_name", action.get("item", "unnamed_quest"))
    objective  = action.get("objective", "No objective specified.")
    player_id  = target  # target is always the player for quests

    quest = start_quest(player_id, quest_name, objective, actor)

    return {
        "action":  "start_quest",
        "success": True,
        "quest":   quest,
        "reason":  "",
    }


def _move_to(action: dict, actor: str, target: str) -> dict:
    location = action.get("location", action.get("item", "unknown"))
    # Stub: just acknowledge, no state change
    return {
        "action":   "move_to",
        "success":  True,
        "actor":    actor,
        "location": location,
        "reason":   "Movement noted (stub implementation).",
    }


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _fail(action_type: str, reason: str) -> dict:
    return {"action": action_type, "success": False, "reason": reason}
