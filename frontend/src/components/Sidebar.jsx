import React from 'react';
import { NPCS, ITEM_ICONS } from '../data/constants';

function getTrustInfo(score = 0) {
  if (score < -50) return { label: "Hostile", color: "#ef5555", bg: "rgba(239,85,85,0.15)" };
  if (score < 0)   return { label: "Suspicious", color: "#efaa55", bg: "rgba(239,170,85,0.15)" };
  if (score < 20)  return { label: "Neutral", color: "#aaaa55", bg: "rgba(170,170,85,0.15)" };
  if (score < 60)  return { label: "Friendly", color: "#55cc77", bg: "rgba(85,204,119,0.15)" };
  return { label: "Trusted", color: "#55bbee", bg: "rgba(85,187,238,0.15)" };
}

export default function Sidebar({ trustScores, inventory, highlightedItems, events }) {
  return (
    <aside className="sidebar" id="sidebar" aria-label="Status">
      {/* 1. TRUST PANEL */}
      <div className="ss" id="trust-panel">
        <div className="st">⚖ Trust Status</div>
        <div id="trust-items">
          {Object.entries(NPCS).map(([id, npc]) => {
            const sc = trustScores[id] ?? 0;
            const { label, color, bg } = getTrustInfo(sc);
            const pct = Math.round(((sc + 100) / 200) * 100);

            return (
              <div key={id} className="trust-item">
                <div className="trust-header">
                  <div className="trust-npc">
                    <div className="tdot" style={{ background: npc.color }} />
                    {npc.icon} {npc.name}
                  </div>
                  <span className="tbadge" style={{ background: bg, color }}>
                    {sc > 0 ? `+${sc}` : sc}
                  </span>
                </div>
                <div className="ttrack">
                  <div className="tfill" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <div className="tlabel">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. INVENTORY POUCH */}
      <div className="ss">
        <div className="st">🎒 Inventory Pouch</div>
        <div className="inv-grid" id="inv-grid">
          {!inventory || Object.keys(inventory).length === 0 ? (
            <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", fontStyle: "italic" }}>
              Pouch is empty
            </span>
          ) : (
            Object.entries(inventory).map(([item, qty]) => {
              const icon = ITEM_ICONS[item] || "📦";
              const isHl = highlightedItems && highlightedItems.includes(item);
              return (
                <div key={item} className={`inv-item ${isHl ? 'hl' : ''}`}>
                  {icon} {item.replace(/_/g, " ")} <span className="qty">×{qty}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. VILLAGE CHRONICLE */}
      <div className="ss">
        <div className="st">📜 Village Chronicle</div>
        <div className="gossip-feed" id="gossip-feed">
          {!events || events.length === 0 ? (
            <div className="no-events" id="no-events">No events yet…</div>
          ) : (
            events.map((e, idx) => (
              <div key={idx} className={`gi ${e.type === 'action' ? 'ga' : ''}`}>
                {e.text}
                <div className="gt">{e.time}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
