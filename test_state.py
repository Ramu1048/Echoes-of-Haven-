"""
test_state.py -- Echoes of Haven
Runs the full demo-spine scenario end-to-end against a fresh test database.

Tests:
  1. Seed the database
  2. Mira learns a secret and gossips it to Rowan (add_memory + mark_shared)
  3. Rowan can retrieve the gossipped memory (get_relevant_memories)
  4. craft_item happy path: Aldric crafts iron_sword for player (inventory update)
  5. craft_item failure: not enough material returns success=False
  6. give_item: Mira gives the player a candle
  7. take_item: Rowan takes a torch from the player
  8. start_quest: Rowan offers the player a quest
  9. Trust update: clamping at boundaries
"""

import os
import sys

# Use an isolated test database so we never corrupt the real one
os.environ["HAVEN_DB"] = "haven_test.db"

# Clean up any previous test run
if os.path.exists("haven_test.db"):
    os.remove("haven_test.db")

from seed_data import seed_all
from memory_store import add_memory, get_relevant_memories, get_all_memories, mark_shared
from relationships import get_relationship, update_relationship
from game_state import get_inventory, modify_inventory, get_active_quests
from actions import execute_action

PLAYER = "ramu"

# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    print(f"  [{status}] {label}" + (f"  ({detail})" if detail else ""))
    if not condition:
        sys.exit(1)   # stop on first failure so errors are obvious


# -----------------------------------------------------------------------
# 1. Seed
# -----------------------------------------------------------------------

print("\n=== 1. Seeding database ===")
seed_all(PLAYER)
check("Player has 100 gold", get_inventory(PLAYER).get("gold") == 100)
check("Aldric has 8 iron",   get_inventory("aldric").get("iron") == 8)
check("Mira trust = 10",     get_relationship("mira", PLAYER) == 10)
check("Rowan trust = -10",   get_relationship("rowan", PLAYER) == -10)
check("Elian trust = 0",     get_relationship("elian", PLAYER) == 0)


# -----------------------------------------------------------------------
# 2. Mira learns a secret + gossips to Rowan
# -----------------------------------------------------------------------

print("\n=== 2. Gossip: Mira -> Rowan ===")

SECRET = "Player is going into the Forbidden Forest tonight"

add_memory("mira", {
    "type":         "fact",
    "content":      SECRET,
    "about_player": PLAYER,
    "shared_with":  [],
})

# Gossip: copy the memory to Rowan
add_memory("rowan", {
    "type":         "fact",
    "content":      SECRET,
    "about_player": PLAYER,
    "shared_with":  [],
})

# Mark on Mira s original memory that it was shared
mark_shared("mira", PLAYER, SECRET, "rowan")

# Verify Mira s record shows shared_with = ["rowan"]
mira_mems = get_all_memories("mira", PLAYER)
mira_secret = next((m for m in mira_mems if m["content"] == SECRET), None)
check("Mira memory exists", mira_secret is not None)
check("Mira shared_with=['rowan']", mira_secret["shared_with"] == ["rowan"],
      str(mira_secret.get("shared_with")))

# Verify Rowan can retrieve it
rowan_mems = get_relevant_memories("rowan", PLAYER, query="forest tonight")
check("Rowan has gossipped memory", any(SECRET in m for m in rowan_mems),
      str(rowan_mems))


# -----------------------------------------------------------------------
# 3. Secrets are hidden without relevant query
# -----------------------------------------------------------------------

print("\n=== 3. Secret gating ===")

elian_no_query = get_relevant_memories("elian", "__world__", query="")
check("Elian secrets hidden on empty query", len(elian_no_query) == 0,
      str(elian_no_query))

elian_with_query = get_relevant_memories("elian", "__world__", query="barrier failing")
check("Elian reveals barrier secret with relevant query",
      any("barrier" in m.lower() for m in elian_with_query),
      str(elian_with_query))


# -----------------------------------------------------------------------
# 4. craft_item -- happy path
# -----------------------------------------------------------------------

print("\n=== 4. craft_item happy path ===")

aldric_iron_before = get_inventory("aldric").get("iron", 0)  # should be 8
player_before      = get_inventory(PLAYER)

result = execute_action({
    "action": "craft_item",
    "actor":  "aldric",
    "target": PLAYER,
    "item":   "iron_sword",
})

check("craft_item success",          result["success"] is True,  str(result))
check("Aldric iron reduced by 2",    get_inventory("aldric").get("iron") == aldric_iron_before - 2)
check("Player received iron_sword",  get_inventory(PLAYER).get("iron_sword", 0) >= 1)


# -----------------------------------------------------------------------
# 5. craft_item -- not enough material
# -----------------------------------------------------------------------

print("\n=== 5. craft_item failure (not enough material) ===")

# Drain aldric iron to 0 for this test
current_iron = get_inventory("aldric").get("iron", 0)
if current_iron > 0:
    modify_inventory("aldric", "iron", -current_iron)

result = execute_action({
    "action": "craft_item",
    "actor":  "aldric",
    "target": PLAYER,
    "item":   "iron_sword",
})

check("craft_item returns success=False", result["success"] is False, str(result))
check("reason is populated",             bool(result.get("reason")), result.get("reason"))

# Restore aldric iron for further tests
modify_inventory("aldric", "iron", 8)


# -----------------------------------------------------------------------
# 6. give_item
# -----------------------------------------------------------------------

print("\n=== 6. give_item ===")

result = execute_action({
    "action":   "give_item",
    "actor":    "mira",
    "target":   PLAYER,
    "item":     "candle",
    "quantity": 1,
})
check("give_item success",          result["success"] is True,             str(result))
check("Player received candle",     get_inventory(PLAYER).get("candle", 0) >= 1)
check("Mira lost a candle",         get_inventory("mira").get("candle", 0) == 3)  # started with 4

# Failure: give something Mira doesn t have
result_fail = execute_action({
    "action": "give_item",
    "actor":  "mira",
    "target": PLAYER,
    "item":   "dragon_egg",
})
check("give_item fails gracefully for missing item", result_fail["success"] is False,
      str(result_fail))


# -----------------------------------------------------------------------
# 7. take_item
# -----------------------------------------------------------------------

print("\n=== 7. take_item ===")

# Player has a torch (from seed)
result = execute_action({
    "action": "take_item",
    "actor":  "rowan",
    "target": PLAYER,
    "item":   "torch",
})
check("take_item success",         result["success"] is True,            str(result))
check("Player lost torch",         get_inventory(PLAYER).get("torch", 0) == 0)
check("Rowan gained torch",        get_inventory("rowan").get("torch", 0) == 4)  # started with 3


# -----------------------------------------------------------------------
# 8. start_quest
# -----------------------------------------------------------------------

print("\n=== 8. start_quest ===")

result = execute_action({
    "action":     "start_quest",
    "actor":      "rowan",
    "target":     PLAYER,
    "quest_name": "Forest Watch",
    "objective":  "Discover what is entering the village through the forest passage.",
})
check("start_quest success", result["success"] is True, str(result))

quests = get_active_quests(PLAYER)
check("Quest in active list",      any(q["name"] == "Forest Watch" for q in quests))
check("Quest giver is rowan",      any(q["giver"] == "rowan" for q in quests))


# -----------------------------------------------------------------------
# 9. Trust clamping
# -----------------------------------------------------------------------

print("\n=== 9. Trust clamping ===")

# Start from Rowan = -10
score = update_relationship("rowan", PLAYER, -200)
check("Trust clamps at -100", score == -100, str(score))

score = update_relationship("rowan", PLAYER, 300)
check("Trust clamps at +100", score == 100, str(score))

# Back to a sensible value
update_relationship("rowan", PLAYER, -110)
check("Rowan trust reset to -10",
      get_relationship("rowan", PLAYER) == -10,
      str(get_relationship("rowan", PLAYER)))


# -----------------------------------------------------------------------
# All done
# -----------------------------------------------------------------------

print("\n\033[92m=== All tests passed. Haven database layer is solid. ===\033[0m\n")

# Windows holds open file handles to SQLite even after context managers exit.
# Force-close all lingering connections before deleting the test DB.
import sqlite3
try:
    _cleanup_conn = sqlite3.connect("haven_test.db")
    _cleanup_conn.close()
except Exception:
    pass
try:
    os.remove("haven_test.db")
except PermissionError:
    print("(Note: haven_test.db could not be deleted — Windows file lock; safe to delete manually.)")
