"""
gossip_engine.py -- Echoes of Haven  (Member 3)
=================================================
Thin re-export so orchestrator.py can import decide_gossip from here
independently of dialogue_engine if needed.

The real logic lives in dialogue_engine.decide_gossip().
"""

from dialogue_engine import decide_gossip  # noqa: F401
