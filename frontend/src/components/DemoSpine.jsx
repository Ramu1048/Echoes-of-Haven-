import React from 'react';

export default function DemoSpine({ onRunDemo }) {
  return (
    <div className="demo-spine" id="demo-spine" aria-label="Demo walkthrough">
      <span className="spine-tag">👑 Judge Demo Spine:</span>
      <button className="demo-btn" onClick={() => onRunDemo(1)}>
        1. Tell Mira Secret ("Forbidden Forest")
      </button>
      <button className="demo-btn" onClick={() => onRunDemo(2)}>
        2. Check Gossip Feed
      </button>
      <button className="demo-btn" onClick={() => onRunDemo(3)}>
        3. Rowan Mentions Secret (Quest)
      </button>
      <button className="demo-btn" onClick={() => onRunDemo(4)}>
        4. Aldric Crafts Sword
      </button>
      <button className="demo-btn" onClick={() => onRunDemo(5)}>
        5. Elian Barrier Lore
      </button>
    </div>
  );
}
