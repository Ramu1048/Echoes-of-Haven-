import React from 'react';
import { NPCS } from '../data/constants';

export default function Header({ selectedNpc, onSelectNpc, playerId, onPlayerIdChange }) {
  return (
    <header className="header" id="header">
      <div className="header-title" id="header-title">
        <div className="crest">⚔️</div>
        <div>
          <h1>Echoes of Haven</h1>
          <div className="sub">Dynamic NPC Brain · AI RPG (React)</div>
        </div>
      </div>

      <nav className="npc-selector" id="npc-selector" aria-label="NPC selection">
        {Object.values(NPCS).map((npc) => {
          const isActive = selectedNpc === npc.id;
          return (
            <button
              key={npc.id}
              className={`npc-btn ${isActive ? 'active' : ''}`}
              data-npc={npc.id}
              id={`btn-${npc.id}`}
              aria-pressed={isActive}
              onClick={() => onSelectNpc(npc.id)}
            >
              <span className="ni">{npc.icon}</span>
              <span className="nn">{npc.name}</span>
              <span className="nr">{npc.role}</span>
            </button>
          );
        })}
      </nav>

      <div className="player-badge" id="player-badge">
        <div className="av">⚔</div>
        <div>
          <label htmlFor="pid">Player: </label>
          <input
            id="pid"
            type="text"
            value={playerId}
            onChange={(e) => onPlayerIdChange(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </div>
      </div>
    </header>
  );
}
