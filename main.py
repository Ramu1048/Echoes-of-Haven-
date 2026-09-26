"""
main.py -- Echoes of Haven  (Member 2)
=======================================
FastAPI app: routes, request/response models, CORS, error handling.

Run locally:
    uvicorn main:app --reload --port 8000

Interactive docs:
    http://localhost:8000/docs

Quick curl test:
    curl -X POST http://localhost:8000/talk \
         -H "Content-Type: application/json" \
         -d '{"npc_id":"mira","player_id":"ramu","message":"I am going into the Forbidden Forest tonight."}'
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from orchestrator import run_talk_flow, get_full_state

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Startup: seed the database once if it is empty
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Seed Haven database on first startup."""
    try:
        from seed_data import seed_inventories, seed_relationships, seed_npc_secrets
        # Seed NPC lore secrets (idempotent)
        seed_npc_secrets()
        # Seed default player ids known at hackathon time
        for pid in ["player", "ramu"]:
            seed_inventories(pid)
            seed_relationships(pid)
        logger.info("Database seeded successfully.")
    except Exception as exc:
        logger.warning("Seed skipped or failed (may already be seeded): %s", exc)
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Echoes of Haven — API",
    description=(
        "Backend for the AI RPG hackathon project. "
        "NPCs remember, gossip, and trigger real game actions."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS  (allow any localhost origin during development)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",   # common React / Next.js dev port
        "http://localhost:5173",   # Vite dev port
        "http://localhost:8501",   # Streamlit
        "http://127.0.0.1:8501",
        "null",                    # local HTML file (file:// origin)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response models (Pydantic)
# ---------------------------------------------------------------------------

VALID_NPC_IDS = {"mira", "rowan", "aldric", "elian"}


class TalkRequest(BaseModel):
    npc_id:    str = Field(..., description="One of: mira, rowan, aldric, elian")
    player_id: str = Field(..., description="Unique player identifier, e.g. 'ramu'")
    message:   str = Field(..., min_length=1, description="Free-text player input")


class ActionResult(BaseModel):
    action:  str
    success: bool
    reason:  str = ""

    class Config:
        extra = "allow"   # action payloads carry extra keys (item, quantity, etc.)


class TalkResponse(BaseModel):
    npc_id:             str
    dialogue:           str
    trust_score:        int
    action_result:      dict | None = None
    inventory_snapshot: dict        = Field(default_factory=dict)
    gossip_event:       str | None  = None


class StateResponse(BaseModel):
    player_id:    str
    trust_scores: dict
    inventory:    dict


# ---------------------------------------------------------------------------
# Global error handler — never expose raw 500 tracebacks to the client
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error":   "internal_server_error",
            "detail":  str(exc),
            "hint":    "Check server logs for the full traceback.",
        },
    )



# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_seeded_players: set = set()

def _ensure_player_seeded(player_id: str) -> None:
    """Auto-seed inventory and trust scores for new players on first contact."""
    if player_id in _seeded_players:
        return
    try:
        from seed_data import seed_inventories, seed_relationships
        seed_inventories(player_id)
        seed_relationships(player_id)
        _seeded_players.add(player_id)
        logger.info("Auto-seeded new player: %s", player_id)
    except Exception as exc:
        logger.warning("Auto-seed failed for player %s: %s", player_id, exc)
        _seeded_players.add(player_id)  # don't retry on every request

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"], summary="Health check")
def health():
    """Quick sanity check — returns 200 if the server is running."""
    return {"status": "ok", "service": "Echoes of Haven API"}


@app.post(
    "/talk",
    response_model=TalkResponse,
    tags=["game"],
    summary="Talk to an NPC",
)
def talk(body: TalkRequest):
    """
    Main game endpoint.

    The player sends a free-text message to an NPC.  The server:
    1. Fetches the NPC's relevant memories of the player.
    2. Fetches the current trust score.
    3. Calls the dialogue engine to generate a reply (and optional action).
    4. Executes any action against real game state.
    5. Logs the exchange as a new memory.
    6. Runs gossip logic — Mira/Rowan may share secrets with each other.
    7. Returns dialogue, trust score, action result, inventory, and gossip event.
    """
    npc_id    = body.npc_id.lower().strip()
    player_id = body.player_id.lower().strip()
    message   = body.message.strip()

    if npc_id not in VALID_NPC_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown NPC '{npc_id}'. Valid options: {sorted(VALID_NPC_IDS)}",
        )

    if not message:
        raise HTTPException(status_code=400, detail="'message' must not be empty.")

    # Auto-seed new players who haven't been seen before
    _ensure_player_seeded(player_id)

    try:
        result = run_talk_flow(npc_id=npc_id, player_id=player_id, message=message)
    except Exception as exc:
        logger.error("run_talk_flow error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    return TalkResponse(**result)


@app.get(
    "/state/{player_id}",
    response_model=StateResponse,
    tags=["debug"],
    summary="Get full game state for a player",
)
def get_state(player_id: str):
    """
    Debug endpoint — returns all NPC trust scores and player inventory.
    Useful for smoke-testing before the frontend connects.
    """
    try:
        state = get_full_state(player_id.lower().strip())
    except Exception as exc:
        logger.error("get_full_state error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    return StateResponse(**state)
