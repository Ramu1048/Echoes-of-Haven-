import React, { useRef, useEffect } from 'react';
import { NPCS } from '../data/constants';

export default function ChatArea({
  selectedNpc,
  messages,
  isTyping,
  inputValue,
  onInputChange,
  onSendMessage,
  isLoading,
  playerId
}) {
  const currentNpc = NPCS[selectedNpc] || NPCS.mira;
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  }

  function handleInput(e) {
    onInputChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 110)}px`;
    }
  }

  return (
    <div className="chat-area" id="chat-area">
      {/* BANNER */}
      <div className="npc-banner" id="npc-banner" style={{ '--nc': currentNpc.color }}>
        <div className="banner-icon" id="banner-icon">{currentNpc.icon}</div>
        <div>
          <div className="banner-npc-name" id="banner-npc-name">{currentNpc.name}</div>
          <div className="banner-npc-desc" id="banner-npc-desc">{currentNpc.desc}</div>
        </div>
        <div className="bstatus">
          <div className="sdot" />
          <span>Online</span>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="messages" id="messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="welcome-msg" id="welcome-msg">
            <span className="rune">🏰</span>
            <p>
              The village of Haven stirs around you.<br />
              Speak to the villagers freely — they remember, gossip, and act.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            if (m.type === 'system') {
              return (
                <div key={m.id} className="msg-system">
                  {m.text}
                </div>
              );
            }
            if (m.type === 'action') {
              return (
                <div key={m.id} className="msg-action">
                  ✨ {m.text}
                </div>
              );
            }
            if (m.type === 'error') {
              return (
                <div key={m.id} className="msg-error">
                  ⚠ {m.text}
                </div>
              );
            }

            const isPlayer = m.from === 'player';
            const npc = NPCS[m.npcId] || currentNpc;

            return (
              <div
                key={m.id}
                className={`message ${isPlayer ? 'player' : 'npc'}`}
                style={{ '--nc': isPlayer ? 'var(--gold)' : npc.color }}
              >
                <div className="msg-av">
                  {isPlayer ? '⚔' : npc.icon}
                </div>
                <div className="msg-content">
                  <div className="msg-sender">
                    {isPlayer ? playerId : npc.name}
                  </div>
                  <div className="msg-bubble">{m.text}</div>
                  <div className="msg-time">{m.time}</div>
                </div>
              </div>
            );
          })
        )}

        {/* TYPING INDICATOR */}
        <div
          className={`typing-indicator ${isTyping ? 'visible' : ''}`}
          id="typing-indicator"
          style={{ '--nc': currentNpc.color }}
        >
          <div className="msg-av">{currentNpc.icon}</div>
          <div className="dots">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="input-bar" id="input-bar">
        <textarea
          ref={textareaRef}
          className="msg-input"
          id="msg-input"
          rows={1}
          placeholder={`Speak to ${currentNpc.name}…`}
          aria-label="Message"
          maxLength={500}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button
          className="send-btn"
          id="send-btn"
          onClick={onSendMessage}
          disabled={isLoading || !inputValue.trim()}
          aria-label="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
