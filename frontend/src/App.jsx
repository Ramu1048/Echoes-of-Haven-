import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import DemoSpine from './components/DemoSpine';
import GameWorld from './components/GameWorld';
import ChatArea from './components/ChatArea';
import Sidebar from './components/Sidebar';
import HotspotModal from './components/HotspotModal';
import Toast from './components/Toast';
import WelcomePage from './components/WelcomePage';
import { NPCS } from './data/constants';

const API_BASE = window.location.origin.includes('5173')
  ? '' // routed through Vite proxy to http://127.0.0.1:8080
  : (window.location.origin.includes('8080') ? window.location.origin : 'http://127.0.0.1:8080');

function formatActionText(action, npcId) {
  const npcName = NPCS[npcId]?.name || "NPC";
  if (action.action === "give_item")   return `${npcName} gave you ${action.item || "item"}${action.quantity > 1 ? ` ×${action.quantity}` : ""}`;
  if (action.action === "take_item")   return `${npcName} took your ${action.item || "item"}`;
  if (action.action === "craft_item")  return `Aldric crafted: ${action.item || "item"}`;
  if (action.action === "start_quest") return `Quest started: ${action.quest?.name || action.quest_name || action.quest_id || "Forest Watch"}`;
  if (action.action === "move_to")     return `${npcName} moved to ${action.location || "somewhere"}`;
  return `Action: ${action.action}`;
}

export default function App() {
  const [showWelcome, setShowWelcome]           = useState(true);
  const [selectedNpc, setSelectedNpc]           = useState('mira');
  const [playerId, setPlayerId]                 = useState('ramu');
  const [trustScores, setTrustScores]           = useState({ mira: 0, rowan: 0, aldric: 0, elian: 0 });
  const [inventory, setInventory]               = useState({ gold: 100, torch: 1, potion: 2 });
  const [highlightedItems, setHighlightedItems] = useState([]);
  const [events, setEvents]                     = useState([]);
  const [messages, setMessages]                 = useState([]);
  const [isTyping, setIsTyping]                 = useState(false);
  const [inputValue, setInputValue]             = useState('');
  const [isLoading, setIsLoading]               = useState(false);
  const [toasts, setToasts]                     = useState([]);
  const [activeHotspot, setActiveHotspot]       = useState(null);

  const gameWorldRef = useRef(null);

  const showToast = useCallback((text, isError = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, isError }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3600);
  }, []);

  const addEvent = useCallback((text, type = 'gossip') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setEvents(prev => [{ text, type, time: now }, ...prev.slice(0, 30)]);
  }, []);

  const fetchState = useCallback(async (pid) => {
    try {
      const res = await fetch(`${API_BASE}/state/${encodeURIComponent(pid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.trust_scores) setTrustScores(data.trust_scores);
        if (data.inventory)    setInventory(data.inventory);
      }
    } catch (err) {
      console.warn("Could not load player state:", err);
    }
  }, []);

  useEffect(() => { fetchState(playerId); }, [playerId, fetchState]);

  const handleSelectNpc = useCallback((npcId) => {
    setSelectedNpc(npcId);
    if (gameWorldRef.current?.walkPlayerToNpc) {
      gameWorldRef.current.walkPlayerToNpc(npcId);
    }
  }, []);

  const handleSendMessage = useCallback(async (textToSend, explicitNpcId) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    // Use explicitly targeted NPC (e.g. from demo spine or walk target), else current selectedNpc
    const activeNpc = explicitNpcId || selectedNpc;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), from: 'player', text, time: timeNow, npcId: activeNpc }]);

    if (gameWorldRef.current?.showSpeechBubble) gameWorldRef.current.showSpeechBubble('player', text);

    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc_id: activeNpc, player_id: playerId, message: text })
      });

      if (!res.ok) {
        let errDetail = `Error ${res.status}`;
        try { const e = await res.json(); errDetail = e.detail || errDetail; } catch {}
        throw new Error(errDetail);
      }

      const data = await res.json();
      setIsTyping(false);

      const respTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { id: Date.now(), from: 'npc', text: data.dialogue, time: respTime, npcId: data.npc_id }]);

      if (gameWorldRef.current?.showSpeechBubble) gameWorldRef.current.showSpeechBubble(data.npc_id, data.dialogue);

      if (typeof data.trust_score === 'number')
        setTrustScores(prev => ({ ...prev, [data.npc_id]: data.trust_score }));

      if (data.inventory_snapshot && Object.keys(data.inventory_snapshot).length > 0) {
        const changedKeys = Object.keys(data.inventory_snapshot).filter(k => data.inventory_snapshot[k] !== inventory[k]);
        setInventory(data.inventory_snapshot);
        if (changedKeys.length > 0) {
          setHighlightedItems(changedKeys);
          setTimeout(() => setHighlightedItems([]), 3000);
        }
      }

      if (data.action_result?.success) {
        const actionText = formatActionText(data.action_result, data.npc_id);
        setMessages(prev => [...prev, { id: Date.now() + 1, type: 'action', text: actionText }]);
        showToast(`⚔ ${actionText}`);
        addEvent(actionText, 'action');
        if (gameWorldRef.current?.triggerActionFx) gameWorldRef.current.triggerActionFx(data.action_result);
      }

      if (data.gossip_event) {
        setMessages(prev => [...prev, { id: Date.now() + 2, type: 'system', text: `👂 ${data.gossip_event}` }]);
        addEvent(data.gossip_event, 'gossip');
        if (gameWorldRef.current?.triggerGossipFx) gameWorldRef.current.triggerGossipFx(data.npc_id);
      }
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), type: 'error', text: `Something went wrong — ${err.message}` }]);
      showToast(`⚠ ${err.message || 'Connection failed'}`, true);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, selectedNpc, playerId, inventory, showToast, addEvent]);

  const handleRunDemo = (step) => {
    if (step === 1) {
      handleSelectNpc('mira');
      handleSendMessage("I am going into the Forbidden Forest tonight.", 'mira');
    } else if (step === 2) {
      showToast("Check Village Chronicle below for Mira's whispered gossip!");
    } else if (step === 3) {
      handleSelectNpc('rowan');
      handleSendMessage("How are the night patrols going?", 'rowan');
    } else if (step === 4) {
      handleSelectNpc('aldric');
      handleSendMessage("I need you to forge me an iron sword. I have the materials.", 'aldric');
    } else if (step === 5) {
      handleSelectNpc('elian');
      handleSendMessage("I have heard the barrier is getting weaker. Is that true?", 'elian');
    }
  };

  const focusChatInput = () => document.getElementById('msg-input')?.focus();

  return (
    <div className="app-container" id="app">
      {/* Top header spanning both columns */}
      <Header
        selectedNpc={selectedNpc}
        onSelectNpc={handleSelectNpc}
        playerId={playerId}
        onPlayerIdChange={setPlayerId}
        onOpenWelcome={() => setShowWelcome(true)}
      />

      {/* Left column: Demo strip + full-height map */}
      <main>
        <DemoSpine onRunDemo={handleRunDemo} />
        <GameWorld
          selectedNpc={selectedNpc}
          onSelectNpc={handleSelectNpc}
          onInspectHotspot={setActiveHotspot}
          gameWorldRef={gameWorldRef}
          onOpenChatInput={focusChatInput}
        />
      </main>

      {/* Right column: chat on top, sidebar stats below */}
      <div className="chat-column">
        <ChatArea
          selectedNpc={selectedNpc}
          messages={messages}
          isTyping={isTyping}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={() => handleSendMessage()}
          isLoading={isLoading}
          playerId={playerId}
        />
        <Sidebar
          trustScores={trustScores}
          inventory={inventory}
          highlightedItems={highlightedItems}
          events={events}
        />
      </div>

      <HotspotModal hotspot={activeHotspot} onClose={() => setActiveHotspot(null)} />
      <Toast toasts={toasts} />
      {showWelcome && <WelcomePage onEnter={() => setShowWelcome(false)} />}
    </div>
  );
}
