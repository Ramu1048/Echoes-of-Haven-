"""
dialogue_engine.py -- Echoes of Haven  (Member 3)
===================================================
AI/Dialogue layer using the modern google-genai SDK (replaces deprecated
google-generativeai).

Public API (called by orchestrator.py):
    generate_npc_reply(npc_id, player_message, memory_context, trust_score) -> dict
    decide_gossip(npc_id, memory_entry) -> str | None
"""

import os
import json
import logging
import pathlib
from dotenv import load_dotenv

from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

load_dotenv()  # Loads GEMINI_API_KEY from .env if present

_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not _API_KEY:
    raise EnvironmentError(
        "No Gemini API key found. Set GEMINI_API_KEY in your .env file or "
        "as an environment variable."
    )

client = genai.Client(api_key=_API_KEY)
logger = logging.getLogger(__name__)

# Persona files live in  <project_root>/personas/{npc_id}.md
_PERSONA_DIR = pathlib.Path(__file__).parent / "personas"

# Models with automatic fallback if one model is rate-limited or busy
_DIALOGUE_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.5-flash"]
_GOSSIP_MODELS   = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.5-flash"]

# ---------------------------------------------------------------------------
# Action tool declarations
# ---------------------------------------------------------------------------

_ACTION_TOOLS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="craft_item",
                description=(
                    "Forge or craft an item for the player. "
                    "Only call this when the player explicitly asks you to make something "
                    "AND you are a blacksmith or have the skill to craft it."
                ),
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "item":     types.Schema(type="STRING",
                                       description="The item to craft, e.g. 'iron_sword'"),
                        "material": types.Schema(type="STRING",
                                       description="Primary material, e.g. 'iron'"),
                    },
                    required=["item"],
                ),
            ),
            types.FunctionDeclaration(
                name="give_item",
                description=(
                    "Give an item to the player from your own inventory. "
                    "Only call this when you genuinely decide (in-character) to give something."
                ),
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "item":     types.Schema(type="STRING",
                                       description="The item to give, e.g. 'torch'"),
                        "quantity": types.Schema(type="INTEGER",
                                       description="How many to give (default 1)"),
                    },
                    required=["item"],
                ),
            ),
            types.FunctionDeclaration(
                name="take_item",
                description=(
                    "Take an item from the player (e.g. as payment or for inspection). "
                    "Only call this when the player offers or hands you something."
                ),
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "item":     types.Schema(type="STRING",
                                       description="The item to take"),
                        "quantity": types.Schema(type="INTEGER",
                                       description="How many to take (default 1)"),
                    },
                    required=["item"],
                ),
            ),
            types.FunctionDeclaration(
                name="start_quest",
                description=(
                    "Officially start a quest for the player. "
                    "Only call this when you are assigning a clear mission or task."
                ),
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "quest_name": types.Schema(type="STRING",
                                          description="Short name of the quest"),
                        "objective":  types.Schema(type="STRING",
                                          description="Clear objective for the player"),
                    },
                    required=["quest_name", "objective"],
                ),
            ),
            types.FunctionDeclaration(
                name="move_to",
                description=(
                    "Move to a location (e.g. to escort the player or change scene). "
                    "Only call this when movement is explicitly part of your response."
                ),
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "location": types.Schema(type="STRING",
                                        description="Destination, e.g. 'Forbidden Forest gate'"),
                    },
                    required=["location"],
                ),
            ),
        ]
    )
]

# ---------------------------------------------------------------------------
# Persona loading
# ---------------------------------------------------------------------------

_persona_cache: dict[str, str] = {}


def _load_persona(npc_id: str) -> str:
    """Load and cache the persona markdown for npc_id."""
    if npc_id in _persona_cache:
        return _persona_cache[npc_id]
    path = _PERSONA_DIR / f"{npc_id}.md"
    if not path.exists():
        raise FileNotFoundError(f"Persona file not found: {path}")
    text = path.read_text(encoding="utf-8")
    _persona_cache[npc_id] = text
    return text


def _build_system_prompt(npc_id: str, memory_context: list | str, trust_score: int) -> str:
    """Fill the persona template with runtime values."""
    template = _load_persona(npc_id)

    if isinstance(memory_context, list):
        mem_str = (
            "\n".join(f"- {m}" for m in memory_context)
            if memory_context
            else "No prior memories of this player."
        )
    else:
        mem_str = memory_context or "No prior memories of this player."

    return (
        template
        .replace("{trust_score}", str(trust_score))
        .replace("{memory_context}", mem_str)
        # Remove the {player_message} placeholder — that goes in the user turn
        .replace("Player says: {player_message}", "")
        .strip()
    )


# ---------------------------------------------------------------------------
# generate_npc_reply
# ---------------------------------------------------------------------------

def generate_npc_reply(
    npc_id: str,
    player_message: str,
    memory_context: list | str,
    trust_score: int,
) -> dict:
    """
    Generate an in-character NPC reply, optionally including a game action.

    Returns:
        {
            "npc_id":   str,
            "dialogue": str,
            "action":   dict | None
        }
    """
    npc_id = npc_id.lower()
    system_prompt = _build_system_prompt(npc_id, memory_context, trust_score)

    response = None
    for model_name in _DIALOGUE_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=player_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=_ACTION_TOOLS,
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(mode="AUTO")
                    ),
                    temperature=0.8,
                    max_output_tokens=300,
                ),
            )
            if response:
                break
        except Exception as exc:
            logger.warning("generate_npc_reply with %s failed: %s; trying fallback model", model_name, exc)
            continue

    if response is not None:
        try:
            dialogue, action = _parse_response(response, npc_id)
        except Exception as exc:
            logger.error("generate_npc_reply parsing failed for %s: %s", npc_id, exc)
            dialogue = _fallback_dialogue(npc_id, trust_score)
            action   = None
    else:
        logger.error("All models failed for %s", npc_id)
        dialogue = _fallback_dialogue(npc_id, trust_score)
        action   = None

    return {"npc_id": npc_id, "dialogue": dialogue, "action": action}


# ---------------------------------------------------------------------------
# decide_gossip
# ---------------------------------------------------------------------------

def decide_gossip(npc_id: str, memory_entry: dict) -> str | None:
    """
    Lightweight LLM call deciding whether npc_id should gossip to another NPC.
    Returns recipient NPC id string or None.
    """
    content = memory_entry.get("content", "")
    if not content:
        return None

    gossip_candidates = {
        "mira":  "rowan",
        "rowan": "mira",
    }
    if npc_id.lower() not in gossip_candidates:
        return None

    candidate = gossip_candidates[npc_id.lower()]

    prompt = (
        f"You are a neutral observer in a medieval RPG called Echoes of Haven.\n"
        f"NPC '{npc_id.capitalize()}' just learned: \"{content}\"\n"
        f"Possible gossip target: '{candidate.capitalize()}'\n\n"
        f"Would {npc_id.capitalize()} tell {candidate.capitalize()} about this?\n"
        f"Rules:\n"
        f"- Only gossip about genuinely dangerous, secret, or urgent information.\n"
        f"- Mundane questions or ordinary facts should NOT be gossiped.\n"
        f"- Forest, barrier, threats, stranger activity = likely gossip.\n\n"
        f'Reply ONLY with valid JSON: {{"should_gossip": true, "reason": "brief explanation"}}'
    )

    response = None
    for model_name in _GOSSIP_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=120,
                    response_mime_type="application/json",
                ),
            )
            if response:
                break
        except Exception as exc:
            logger.warning("decide_gossip with %s failed: %s; trying next model", model_name, exc)
            continue

    if not response:
        return None  # Fall back to rule-based gossip in orchestrator

    try:
        raw = (response.text or "").strip()

        # Robust JSON extraction: strip fences or match outer braces
        cleaned = raw
        if "```" in cleaned:
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()

        data = {}
        import re
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except Exception:
                pass
        if not data and cleaned:
            try:
                data = json.loads(cleaned)
            except Exception:
                data = {}

        if data.get("should_gossip"):
            logger.info(
                "decide_gossip: %s -> %s | reason: %s",
                npc_id, candidate, data.get("reason", ""),
            )
            return candidate
        return None

    except Exception as exc:
        logger.warning("decide_gossip parsing failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_response(response, npc_id: str) -> tuple[str, dict | None]:
    """Parse a Gemini response that may contain text, a function call, or both."""
    action        = None
    dialogue_parts = []

    for candidate in response.candidates:
        for part in candidate.content.parts:
            if hasattr(part, "function_call") and part.function_call and part.function_call.name:
                fc   = part.function_call
                args = dict(fc.args) if fc.args else {}
                action = {
                    "action": fc.name,
                    "actor":  npc_id,
                    "target": args.pop("target", "player"),
                    **args,
                }
                logger.info("Tool call from %s: %s(%s)", npc_id, fc.name, args)
            elif hasattr(part, "text") and part.text:
                dialogue_parts.append(part.text.strip())

    dialogue = " ".join(dialogue_parts).strip()

    # If only a tool call was returned, synthesise brief narration
    if not dialogue and action:
        dialogue = _action_narration(npc_id, action)

    if not dialogue:
        dialogue = _fallback_dialogue(npc_id, 0)

    return dialogue, action


def _action_narration(npc_id: str, action: dict) -> str:
    """Brief in-character narration when the model only returns a tool call."""
    act      = action.get("action", "")
    item     = action.get("item", "something")
    location = action.get("location", "the destination")
    narrations = {
        "craft_item":  f"{npc_id.capitalize()} nods and fires up the forge. 'Give me a moment with this {item}.'",
        "give_item":   f"{npc_id.capitalize()} reaches under the counter and slides the {item} across to you.",
        "take_item":   f"{npc_id.capitalize()} carefully takes the {item} from your hands.",
        "start_quest": f"{npc_id.capitalize()} looks at you with steady eyes. 'Then here is your task.'",
        "move_to":     f"{npc_id.capitalize()} turns and begins walking toward {location}.",
    }
    return narrations.get(act, f"{npc_id.capitalize()} acts.")


def _fallback_dialogue(npc_id: str, trust_score: int) -> str:
    """Safe in-character fallback when the LLM call fails."""
    fallbacks = {
        "mira":   "Mira glances up from wiping the counter. \"Something on your mind, traveller?\"",
        "rowan":  "Rowan fixes you with a hard stare. \"State your business.\"",
        "aldric": "Aldric sets his hammer down and looks up. \"What is it?\"",
        "elian":  "Elian peers at you over an open tome. \"Yes... what is it you want?\"",
    }
    return fallbacks.get(npc_id, f"{npc_id.capitalize()} regards you in silence.")
