import React, { useRef, useEffect, useState } from 'react';
import { NPCS, HOTSPOTS } from '../data/constants';

export default function GameWorld({
  selectedNpc,
  onSelectNpc,
  onInspectHotspot,
  gameWorldRef,
  onOpenChatInput
}) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const promptRef    = useRef(null);

  const [timeOfDay,    setTimeOfDay]    = useState('dusk');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // ── Stable refs to prevent tearing down canvas/player on renders ──
  const onSelectNpcRef     = useRef(onSelectNpc);
  const onInspectHotspotRef = useRef(onInspectHotspot);
  const onOpenChatInputRef = useRef(onOpenChatInput);
  const timeOfDayRef       = useRef(timeOfDay);
  const audioEnabledRef    = useRef(audioEnabled);
  const selectedNpcRef     = useRef(selectedNpc);
  const playerRef          = useRef(null);

  useEffect(() => { onSelectNpcRef.current = onSelectNpc; }, [onSelectNpc]);
  useEffect(() => { onInspectHotspotRef.current = onInspectHotspot; }, [onInspectHotspot]);
  useEffect(() => { onOpenChatInputRef.current = onOpenChatInput; }, [onOpenChatInput]);
  useEffect(() => { timeOfDayRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => { selectedNpcRef.current = selectedNpc; }, [selectedNpc]);

  // Whenever selectedNpc changes from parent (e.g. Header, DemoSpine), walk player to that NPC
  useEffect(() => {
    if (selectedNpc && gameWorldRef?.current?.walkPlayerToNpc) {
      gameWorldRef.current.walkPlayerToNpc(selectedNpc);
    }
  }, [selectedNpc, gameWorldRef]);

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    const promptEl  = promptRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    let animId = null;
    let audioCtx = null;
    let time = 0;
    const keys = {};

    let width  = container.clientWidth  || 800;
    let height = container.clientHeight || 500;

    function resize() {
      if (!container || !canvas) return;
      width  = container.clientWidth  || 800;
      height = container.clientHeight || 500;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    // ---- Zone boundaries ----
    // ANCIENT FOREST:  top 28% of map
    // MAGICAL BARRIER: thin band ~28-34% 
    // VILLAGE:         34-100%
    function forestHeight()  { return Math.floor(height * 0.28); }
    function barrierY()      { return forestHeight(); }
    function barrierH()      { return Math.floor(height * 0.06); }
    function villageY()      { return barrierY() + barrierH(); }
    function villageH()      { return height - villageY(); }

    // Player starts in village center or maintains current position across renders
    let player = playerRef.current;
    if (!player) {
      player = {
        x: width * 0.45, y: villageY() + villageH() * 0.45,
        targetX: null, targetY: null,
        speed: 2.8, sprintMult: 1.0,
        dir: 'down', walkCycle: 0, isMoving: false,
        color: '#4ade80', breath: 0, blinkTimer: 100
      };
      playerRef.current = player;
    }

    // NPC positions adapt to zone layout
    const npcs = {
      mira: {
        id: 'mira', name: 'Mira', role: 'Tavern Keeper',
        get x() { return width * 0.18; },
        get y() { return villageY() + villageH() * 0.22; },
        color: '#e07a90', dir: 'down',
        mood: 'Pouring Ale', moodIcon: '🍺',
        hairColor: '#b45309', clothesColor: '#991b1b',
        frame: 0, breath: 0,
        barks: ["Careful… the shadows grow long.", "Another pint, freshly tapped.", "Walls have ears here, traveller."],
        barkTimer: 280
      },
      rowan: {
        id: 'rowan', name: 'Rowan', role: 'Guard Captain',
        x: 0, y: 0,  // set in update
        color: '#4a9fd4', dir: 'left',
        mood: 'Sentry Patrol', moodIcon: '🛡️',
        patrolDir: -0.7, frame: 0, breath: 0.5, alertState: false,
        hairColor: '#475569', clothesColor: '#334155',
        barks: ["Halt! State your business.", "The tree line is restless tonight.", "No entry without decree."],
        barkTimer: 400
      },
      aldric: {
        id: 'aldric', name: 'Aldric', role: 'Blacksmith',
        get x() { return width * 0.16; },
        get y() { return villageY() + villageH() * 0.72; },
        color: '#d4904a', dir: 'right',
        mood: 'Forging Steel', moodIcon: '🔨',
        hammerTimer: 0, hammerDown: false,
        frame: 0, breath: 1.0,
        hairColor: '#271c19', clothesColor: '#d97706',
        barks: ["Iron requires heat and conviction.", "A blade remembers the hand that forged it.", "The coals glow true tonight."],
        barkTimer: 340
      },
      elian: {
        id: 'elian', name: 'Elian', role: 'Mage',
        get x() { return width * 0.84; },
        get y() { return villageY() + villageH() * 0.35; },
        color: '#9a6ee0', dir: 'down',
        mood: 'Weaving Wards', moodIcon: '🔮',
        runeAngle: 0, frame: 0, breath: 1.5,
        hairColor: '#e2e8f0', clothesColor: '#6b21a8',
        bookBob: 0,
        barks: ["The barrier is fraying at the edges…", "Runes of Haven… heed my chant.", "Darkness bleeds through the rift."],
        barkTimer: 460
      }
    };

    // Rowan starts near barrier gate
    npcs.rowan.x = width * 0.5;
    npcs.rowan.y = villageY() + 30;
    npcs.rowan.patrolMin = width * 0.32;
    npcs.rowan.patrolMax = width * 0.68;

    let nearNpc      = null;
    let nearHotspot  = null;
    const particles  = [];
    const dustPuffs  = [];
    const fireflies  = [];
    const wisps      = [];
    let speechBubbles = [];

    // Fireflies cluster near forest / barrier
    for (let i = 0; i < 40; i++) {
      fireflies.push({
        x: Math.random() * width,
        y: Math.random() * (forestHeight() + barrierH()),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        inForest: true
      });
    }
    for (let i = 0; i < 16; i++) {
      fireflies.push({
        x: Math.random() * width,
        y: villageY() + Math.random() * villageH(),
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2,
        inForest: false
      });
    }

    // ---- Audio ----
    function playSfx(type) {
      if (!audioEnabledRef.current) return;
      try {
        if (!audioCtx) {
          const A = window.AudioContext || window.webkitAudioContext;
          if (A) audioCtx = new A();
        }
        if (!audioCtx) return;
        const now  = audioCtx.currentTime;
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'step') {
          osc.frequency.setValueAtTime(160 + (time % 2 === 0 ? 30 : -20), now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'anvil') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1180, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.28);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now); osc.stop(now + 0.45);
        } else if (type === 'magic') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.linearRampToValueAtTime(783.99, now + 0.3);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5);
        }
      } catch (e) {}
    }

    // Expose to parent React ref
    if (gameWorldRef) {
      gameWorldRef.current = {
        walkPlayerToNpc: (npcId) => {
          const npc = npcs[npcId];
          if (npc) {
            const nx = typeof npc.x === 'function' ? npc.x() : npc.x;
            const ny = typeof npc.y === 'function' ? npc.y() : npc.y;
            player.targetX = nx + (nx < width / 2 ? 44 : -44);
            player.targetY = ny + 10;
          }
        },
        showSpeechBubble: (charId, text) => {
          let source = charId === 'player' ? player : npcs[charId];
          if (!source) source = npcs.mira;
          const sx = typeof source.x === 'function' ? source.x() : source.x;
          const sy = typeof source.y === 'function' ? source.y() : source.y;
          const clean = text.replace(/<[^>]*>?/gm, '').slice(0, 90) + (text.length > 90 ? '…' : '');
          speechBubbles = speechBubbles.filter(b => b.charId !== charId);
          speechBubbles.push({ charId, text: clean, x: sx, y: sy - 52, life: 380, maxLife: 380 });
        },
        triggerGossipFx: (fromNpcId) => {
          const fromNpc = npcs[fromNpcId] || npcs.mira;
          const toNpc   = fromNpcId === 'rowan' ? npcs.mira : npcs.rowan;
          playSfx('magic');
          const fx = typeof fromNpc.x === 'function' ? fromNpc.x() : fromNpc.x;
          const fy = typeof fromNpc.y === 'function' ? fromNpc.y() : fromNpc.y;
          wisps.push({
            x: fx, y: fy - 20,
            targetX: typeof toNpc.x === 'function' ? toNpc.x() : toNpc.x,
            targetY: (typeof toNpc.y === 'function' ? toNpc.y() : toNpc.y) - 20,
            targetNpc: toNpc, progress: 0, speed: 0.015
          });
          if (fromNpcId === 'mira') {
            npcs.mira.mood = 'Whispering Secrets'; npcs.mira.moodIcon = '🤫';
          }
        },
        triggerActionFx: (action) => {
          if (action.action === 'craft_item') {
            playSfx('anvil');
            npcs.aldric.mood = 'Blade Forged'; npcs.aldric.moodIcon = '✨';
            const ax = typeof npcs.aldric.x === 'function' ? npcs.aldric.x() : npcs.aldric.x;
            const ay = typeof npcs.aldric.y === 'function' ? npcs.aldric.y() : npcs.aldric.y;
            for (let i = 0; i < 50; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 2 + Math.random() * 5;
              particles.push({ x: ax + 20, y: ay + 6, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2.5, life: 45 + Math.random() * 25, color: '#f59e0b', size: 2.5 });
            }
          } else {
            playSfx('magic');
            for (let i = 0; i < 30; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 1.2 + Math.random() * 2.5;
              particles.push({ x: player.x, y: player.y - 15, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.2, life: 40 + Math.random() * 20, color: '#60a5fa', size: 2.5 });
            }
          }
        }
      };
    }

    // Keyboard
    function onKeyDown(e) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Shift') player.sprintMult = 1.7;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { keys[e.key] = true; e.preventDefault(); }
      if (e.key.toLowerCase() === 'e' && nearNpc) {
        selectedNpcRef.current = nearNpc.id;
        if (onSelectNpcRef.current) onSelectNpcRef.current(nearNpc.id);
        if (onOpenChatInputRef.current) onOpenChatInputRef.current();
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (nearHotspot) {
          if (onInspectHotspotRef.current) onInspectHotspotRef.current(nearHotspot);
          playSfx('magic');
        } else if (nearNpc) {
          selectedNpcRef.current = nearNpc.id;
          if (onSelectNpcRef.current) onSelectNpcRef.current(nearNpc.id);
          if (onOpenChatInputRef.current) onOpenChatInputRef.current();
        }
      }
    }
    function onKeyUp(e) {
      keys[e.key.toLowerCase()] = false;
      if (e.key === 'Shift') player.sprintMult = 1.0;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) keys[e.key] = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function onCanvasClick(e) {
      const rect   = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let clickedNpc = null;
      for (const npc of Object.values(npcs)) {
        const nx = typeof npc.x === 'function' ? npc.x() : npc.x;
        const ny = typeof npc.y === 'function' ? npc.y() : npc.y;
        if (Math.hypot(clickX - nx, clickY - ny) < 38) { clickedNpc = npc; break; }
      }

      if (clickedNpc) {
        const nx = typeof clickedNpc.x === 'function' ? clickedNpc.x() : clickedNpc.x;
        const ny = typeof clickedNpc.y === 'function' ? clickedNpc.y() : clickedNpc.y;
        player.targetX = nx + (nx > player.x ? -36 : 36);
        player.targetY = ny + 10;
        selectedNpcRef.current = clickedNpc.id;
        if (onSelectNpcRef.current) onSelectNpcRef.current(clickedNpc.id);
      } else {
        let clickedHotspot = null;
        for (const h of HOTSPOTS) {
          if (Math.hypot(clickX - h.x * (width/760), clickY - h.y * (height/330)) < h.radius) { clickedHotspot = h; break; }
        }
        if (clickedHotspot) {
          if (onInspectHotspotRef.current) onInspectHotspotRef.current(clickedHotspot);
        } else {
          player.targetX = clickX;
          player.targetY = Math.max(villageY() + 5, clickY);
        }
      }
    }
    canvas.addEventListener('click', onCanvasClick);

    // ====== UPDATE ======
    function update() {
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup'])    dy -= 1;
      if (keys['s'] || keys['arrowdown'])  dy += 1;
      if (keys['a'] || keys['arrowleft'])  dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      const spd = player.speed * player.sprintMult;

      if (dx !== 0 || dy !== 0) {
        player.targetX = null; player.targetY = null;
        const len = Math.hypot(dx, dy);
        player.x += (dx / len) * spd;
        player.y += (dy / len) * spd;
        player.isMoving  = true;
        player.walkCycle += 0.22 * player.sprintMult;
        if (time % (player.sprintMult > 1.2 ? 12 : 18) === 0) {
          playSfx('step');
          dustPuffs.push({ x: player.x + (Math.random() - 0.5) * 6, y: player.y + 12, life: 14, maxLife: 14, r: 2 + Math.random() * 2 });
        }
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
        else player.dir = dy > 0 ? 'down' : 'up';
      } else if (player.targetX !== null && player.targetY !== null) {
        const tdx = player.targetX - player.x;
        const tdy = player.targetY - player.y;
        const dist = Math.hypot(tdx, tdy);
        if (dist > 3) {
          player.x += (tdx / dist) * spd;
          player.y += (tdy / dist) * spd;
          player.isMoving  = true;
          player.walkCycle += 0.22;
          if (time % 18 === 0) playSfx('step');
          if (Math.abs(tdx) > Math.abs(tdy)) player.dir = tdx > 0 ? 'right' : 'left';
          else player.dir = tdy > 0 ? 'down' : 'up';
        } else { player.targetX = null; player.targetY = null; player.isMoving = false; }
      } else { player.isMoving = false; }

      // Keep player in village zone (can't enter forest)
      player.x = Math.max(30, Math.min(width - 30, player.x));
      player.y = Math.max(villageY() + 10, Math.min(height - 30, player.y));
      player.breath = Math.sin(time * 0.05);
      player.blinkTimer--;
      if (player.blinkTimer <= 0) player.blinkTimer = 180 + Math.random() * 100;

      // Animate NPCs
      for (const npc of Object.values(npcs)) {
        npc.breath = Math.sin(time * 0.05 + (typeof npc.x === 'function' ? npc.x() : npc.x));
        npc.barkTimer--;
        if (npc.barkTimer <= 0) {
          npc.barkTimer = 480 + Math.random() * 320;
          const bark = npc.barks[Math.floor(Math.random() * npc.barks.length)];
          if (gameWorldRef?.current?.showSpeechBubble) gameWorldRef.current.showSpeechBubble(npc.id, bark);
        }
        const nx = typeof npc.x === 'function' ? npc.x() : npc.x;
        const ny = typeof npc.y === 'function' ? npc.y() : npc.y;
        const d = Math.hypot(player.x - nx, player.y - ny);
        if (d < 100) {
          const adx = player.x - nx; const ady = player.y - ny;
          if (Math.abs(adx) > Math.abs(ady)) npc.dir = adx > 0 ? 'right' : 'left';
          else npc.dir = ady > 0 ? 'down' : 'up';
        }
      }

      // Rowan patrol near barrier gate
      const rowan = npcs.rowan;
      if (!rowan.alertState) {
        rowan.x += rowan.patrolDir;
        if (rowan.x <= rowan.patrolMin) { rowan.patrolDir = 0.65; rowan.dir = 'right'; }
        else if (rowan.x >= rowan.patrolMax) { rowan.patrolDir = -0.65; rowan.dir = 'left'; }
      }
      rowan.frame += 0.12;

      // Aldric hammer
      const aldric = npcs.aldric;
      aldric.hammerTimer = (aldric.hammerTimer + 1) % 150;
      if (aldric.hammerTimer === 75) {
        aldric.hammerDown = true; playSfx('anvil');
        const ax = typeof aldric.x === 'function' ? aldric.x() : aldric.x;
        const ay = typeof aldric.y === 'function' ? aldric.y() : aldric.y;
        for (let i = 0; i < 9; i++) particles.push({ x: ax + 20, y: ay + 6, vx: (Math.random() - 0.5) * 3.8, vy: -Math.random() * 3.2 - 0.5, life: 25 + Math.random() * 15, color: '#fbbf24', size: 2.2 });
      } else if (aldric.hammerTimer > 92) aldric.hammerDown = false;

      npcs.elian.runeAngle += 0.018;
      npcs.elian.bookBob = Math.sin(time * 0.08) * 3;

      // Firefly motion
      for (const ff of fireflies) {
        ff.phase += 0.05;
        ff.x += ff.vx + Math.sin(ff.phase) * 0.3;
        ff.y += ff.vy + Math.cos(ff.phase) * 0.3;
        if (ff.x < 5) ff.x = width - 10; if (ff.x > width - 5) ff.x = 10;
        const maxY = ff.inForest ? forestHeight() + barrierH() : height;
        const minY = ff.inForest ? 5 : villageY();
        if (ff.y < minY) ff.y = maxY - 5; if (ff.y > maxY - 5) ff.y = minY + 5;
      }

      // Proximity check
      let closestNpc = null; let closestDist = 68;
      for (const npc of Object.values(npcs)) {
        const nx = typeof npc.x === 'function' ? npc.x() : npc.x;
        const ny = typeof npc.y === 'function' ? npc.y() : npc.y;
        const d = Math.hypot(player.x - nx, player.y - ny);
        if (d < closestDist) { closestNpc = npc; closestDist = d; }
      }
      nearNpc = closestNpc;

      // Auto-select conversation target when traveler is standing in front of an NPC
      if (closestNpc && closestNpc.id !== selectedNpcRef.current && !player.isMoving) {
        selectedNpcRef.current = closestNpc.id;
        if (onSelectNpcRef.current) onSelectNpcRef.current(closestNpc.id);
      }

      // Prompt overlay
      if (promptEl) {
        if (closestNpc) {
          const nx = typeof closestNpc.x === 'function' ? closestNpc.x() : closestNpc.x;
          const ny = typeof closestNpc.y === 'function' ? closestNpc.y() : closestNpc.y;
          promptEl.style.display = 'block';
          promptEl.style.left    = `${nx}px`;
          promptEl.style.top     = `${ny - 44}px`;
          promptEl.textContent   = `[E] Speak with ${closestNpc.name} (${closestNpc.mood})`;
        } else { promptEl.style.display = 'none'; }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = dustPuffs.length - 1; i >= 0; i--) {
        const dp = dustPuffs[i]; dp.life--; dp.r += 0.2;
        if (dp.life <= 0) dustPuffs.splice(i, 1);
      }

      // Wisps
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.progress += w.speed;
        w.x += (w.targetX - w.x) * w.speed * 4;
        w.y += (w.targetY - w.y) * w.speed * 4;
        if (time % 2 === 0) particles.push({ x: w.x, y: w.y, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 25, color: Math.random() > 0.5 ? '#c084fc' : '#f59e0b', size: 3 });
        if (w.progress >= 1 || Math.hypot(w.targetX - w.x, w.targetY - w.y) < 16) {
          if (gameWorldRef?.current?.showSpeechBubble) gameWorldRef.current.showSpeechBubble(w.targetNpc.id, '(!) Mira sent word…');
          if (w.targetNpc.id === 'rowan') { rowan.alertState = true; rowan.mood = 'High Alert (Informed)'; rowan.moodIcon = '⚔️'; }
          wisps.splice(i, 1);
        }
      }

      // Speech bubbles
      for (let i = speechBubbles.length - 1; i >= 0; i--) {
        const b = speechBubbles[i]; b.life--;
        const src = b.charId === 'player' ? player : npcs[b.charId];
        if (src) {
          b.x = typeof src.x === 'function' ? src.x() : src.x;
          b.y = (typeof src.y === 'function' ? src.y() : src.y) - 52;
        }
        if (b.life <= 0) speechBubbles.splice(i, 1);
      }
    }

    // ====== RENDER ======
    function render() {
      ctx.clearRect(0, 0, width, height);
      drawForestZone();
      drawBarrierZone();
      drawVillageZone();
      drawHotspotRings();

      for (const dp of dustPuffs) {
        ctx.fillStyle = `rgba(168,142,114,${dp.life / dp.maxLife * 0.35})`;
        ctx.beginPath(); ctx.arc(dp.x, dp.y, dp.r, 0, Math.PI * 2); ctx.fill();
      }

      for (const npc of Object.values(npcs)) {
        const nx = typeof npc.x === 'function' ? npc.x() : npc.x;
        const ny = typeof npc.y === 'function' ? npc.y() : npc.y;
        drawProximityRing(nx, ny, nearNpc && nearNpc.id === npc.id);
        drawNpc(npc);
      }
      drawPlayer();

      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const w of wisps) {
        const glow = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 18);
        glow.addColorStop(0, 'rgba(243,232,255,0.95)');
        glow.addColorStop(0.5, 'rgba(192,132,252,0.6)');
        glow.addColorStop(1, 'rgba(192,132,252,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(w.x, w.y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w.x, w.y, 4, 0, Math.PI * 2); ctx.fill();
      }

      drawAtmosphere();

      for (const b of speechBubbles) drawSpeechBubble(b);

      drawMiniMap();
      drawZoneLabels();
    }

    // ====== DRAW: ANCIENT FOREST ZONE ======
    function drawForestZone() {
      const fh = forestHeight();

      // Sky gradient — deep purple night sky
      const sky = ctx.createLinearGradient(0, 0, 0, fh);
      sky.addColorStop(0, '#06020f');
      sky.addColorStop(0.6, '#0d0520');
      sky.addColorStop(1, '#1a0a2e');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, fh);

      // Stars
      ctx.save();
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137.5) % width);
        const sy = ((i * 97.3) % (fh * 0.7));
        const br = (Math.sin(time * 0.03 + i) + 1) / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.2 + br * 0.6})`;
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }
      ctx.restore();

      // Distant fog layer at forest floor
      const fogGrad = ctx.createLinearGradient(0, fh * 0.55, 0, fh);
      fogGrad.addColorStop(0, 'rgba(40,10,80,0)');
      fogGrad.addColorStop(0.5, 'rgba(60,20,100,0.3)');
      fogGrad.addColorStop(1, 'rgba(80,30,120,0.5)');
      ctx.fillStyle = fogGrad; ctx.fillRect(0, 0, width, fh);

      // Deep background trees
      drawForestTrees(fh, false);

      // Glowing corruption cracks near barrier
      ctx.save();
      ctx.strokeStyle = `rgba(140,40,220,${0.3 + Math.sin(time * 0.04) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12; ctx.shadowColor = '#8b14dc';
      for (let ci = 0; ci < 5; ci++) {
        const cx = width * (0.1 + ci * 0.2);
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(time * 0.02 + ci) * 6, fh * 0.4);
        ctx.bezierCurveTo(
          cx + 15, fh * 0.55,
          cx - 10, fh * 0.7,
          cx + Math.sin(time * 0.03 + ci * 2) * 8, fh * 0.9
        );
        ctx.stroke();
      }
      ctx.restore();

      // Foreground silhouette trees
      drawForestTrees(fh, true);
    }

    function drawForestTrees(fh, foreground) {
      const count = foreground ? 14 : 9;
      const zOff  = foreground ? 0.7 : 0.4;
      ctx.save();
      for (let i = 0; i < count; i++) {
        const tx    = (i / (count - 1)) * (width + 40) - 20;
        const tBase = fh;
        const tH    = foreground
          ? (60 + ((i * 47) % 40))
          : (40 + ((i * 61) % 30));
        const tW    = foreground ? 28 + (i % 3) * 8 : 18 + (i % 3) * 6;

        const alpha = foreground ? 1.0 : 0.55;
        const darkG = foreground
          ? `rgba(8,18,8,${alpha})`
          : `rgba(12,24,12,${alpha})`;
        const midG  = foreground
          ? `rgba(15,35,12,${alpha})`
          : `rgba(20,45,16,${alpha})`;

        // Trunk
        ctx.fillStyle = foreground ? '#1a0f08' : '#0f0804';
        ctx.fillRect(tx - 4, tBase - tH * 0.35, 8, tH * 0.38);

        // Layered pine canopy
        for (let layer = 0; layer < 3; layer++) {
          const ly   = tBase - tH * (0.3 + layer * 0.28);
          const lw   = tW * (1 - layer * 0.22);
          const lh   = tH * 0.38;
          const grad = ctx.createLinearGradient(tx - lw / 2, ly - lh, tx + lw / 2, ly);
          grad.addColorStop(0, midG);
          grad.addColorStop(1, darkG);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(tx, ly - lh);
          ctx.lineTo(tx - lw / 2, ly);
          ctx.lineTo(tx + lw / 2, ly);
          ctx.closePath();
          ctx.fill();
        }

        // Bioluminescent tips (foreground)
        if (foreground) {
          const glowA = (Math.sin(time * 0.04 + i * 1.3) + 1) / 2 * 0.6;
          ctx.fillStyle = `rgba(80,200,120,${glowA})`;
          ctx.beginPath(); ctx.arc(tx, tBase - tH * 0.96, 3, 0, Math.PI * 2); ctx.fill();
          const gw = ctx.createRadialGradient(tx, tBase - tH * 0.96, 0, tx, tBase - tH * 0.96, 20);
          gw.addColorStop(0, `rgba(60,220,100,${glowA * 0.4})`);
          gw.addColorStop(1, 'rgba(60,220,100,0)');
          ctx.fillStyle = gw;
          ctx.beginPath(); ctx.arc(tx, tBase - tH * 0.96, 20, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // ====== DRAW: MAGICAL BARRIER ======
    function drawBarrierZone() {
      const by = barrierY();
      const bh = barrierH();

      // Base band
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, '#1a0a2e');
      bg.addColorStop(0.4, '#2d0d50');
      bg.addColorStop(1, '#160b28');
      ctx.fillStyle = bg; ctx.fillRect(0, by, width, bh);

      // Animated energy wave
      ctx.save();
      const waveY = by + bh * 0.5;
      const wPulse = 0.6 + Math.sin(time * 0.06) * 0.4;

      // Outer glow
      const barrierGlow = ctx.createLinearGradient(0, by - 10, 0, by + bh + 10);
      barrierGlow.addColorStop(0, 'rgba(140,60,240,0)');
      barrierGlow.addColorStop(0.3, `rgba(140,60,240,${0.25 * wPulse})`);
      barrierGlow.addColorStop(0.5, `rgba(180,80,255,${0.45 * wPulse})`);
      barrierGlow.addColorStop(0.7, `rgba(140,60,240,${0.25 * wPulse})`);
      barrierGlow.addColorStop(1, 'rgba(140,60,240,0)');
      ctx.fillStyle = barrierGlow; ctx.fillRect(0, by - 10, width, bh + 20);

      // Core barrier line with wave
      ctx.beginPath();
      ctx.strokeStyle = `rgba(210,140,255,${0.7 + Math.sin(time * 0.08) * 0.3})`;
      ctx.lineWidth   = 2.5;
      ctx.shadowBlur  = 20; ctx.shadowColor = '#b060ff';
      for (let bx = 0; bx <= width; bx += 4) {
        const yOff = Math.sin(bx * 0.025 + time * 0.07) * 5
                   + Math.sin(bx * 0.04 + time * 0.05) * 3;
        if (bx === 0) ctx.moveTo(bx, waveY + yOff);
        else ctx.lineTo(bx, waveY + yOff);
      }
      ctx.stroke();

      // Secondary crackle lines
      for (let ci = 0; ci < 6; ci++) {
        const cracklePulse = Math.sin(time * 0.12 + ci * 1.1);
        if (cracklePulse > 0.5) {
          ctx.strokeStyle = `rgba(220,160,255,${(cracklePulse - 0.5) * 1.2})`;
          ctx.lineWidth   = 1;
          ctx.shadowBlur  = 8; ctx.shadowColor = '#d0a0ff';
          ctx.beginPath();
          const cx1 = (width / 7) * (ci + 0.5);
          ctx.moveTo(cx1, by);
          ctx.lineTo(cx1 + (Math.random() - 0.5) * 20, by + bh * 0.5);
          ctx.lineTo(cx1 + (Math.random() - 0.5) * 15, by + bh);
          ctx.stroke();
        }
      }

      // Barrier pillars / rune stones
      const pillarCount = 5;
      for (let pi = 0; pi < pillarCount; pi++) {
        const px   = (width / (pillarCount + 1)) * (pi + 1);
        const glow = 0.6 + Math.sin(time * 0.05 + pi * 0.8) * 0.4;

        // Stone
        ctx.fillStyle = '#2a1640';
        ctx.fillRect(px - 5, by - 8, 10, bh + 16);
        ctx.fillStyle = '#3a2058';
        ctx.fillRect(px - 6, by - 10, 12, 8);
        ctx.fillRect(px - 6, by + bh + 2, 12, 8);

        // Rune glow
        const rGrad = ctx.createRadialGradient(px, waveY, 0, px, waveY, 22);
        rGrad.addColorStop(0, `rgba(180,80,255,${glow * 0.9})`);
        rGrad.addColorStop(1, 'rgba(140,40,220,0)');
        ctx.fillStyle = rGrad;
        ctx.beginPath(); ctx.arc(px, waveY, 22, 0, Math.PI * 2); ctx.fill();

        // Rune symbol
        ctx.fillStyle = `rgba(240,200,255,${glow})`;
        ctx.font = '9px serif'; ctx.textAlign = 'center';
        const runes = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ'];
        ctx.fillText(runes[pi], px, waveY + 3.5);
      }

      // "MAGICAL BARRIER" label on barrier band
      ctx.shadowBlur = 0; ctx.restore();

      // Barrier fireflies
      ctx.save();
      for (const ff of fireflies) {
        if (!ff.inForest) continue;
        const pA = (Math.sin(ff.phase) + 1) / 2;
        const col = ff.y < forestHeight() * 0.6 ? `rgba(80,255,120,${pA * 0.85})` : `rgba(200,120,255,${pA * 0.85})`;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(ff.x, ff.y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ====== DRAW: VILLAGE ZONE ======
    function drawVillageZone() {
      const vy = villageY();
      const vh = villageH();
      const cx = width / 2;

      // Ground gradient — warm earthy tones
      const ground = ctx.createLinearGradient(0, vy, 0, height);
      ground.addColorStop(0, '#1c1408');
      ground.addColorStop(0.3, '#221a0c');
      ground.addColorStop(1, '#0f0b06');
      ctx.fillStyle = ground; ctx.fillRect(0, vy, width, vh);

      // Cobblestone paths (cross pattern)
      ctx.save();
      const pathY = vy + vh * 0.45;
      const pathGrad = ctx.createLinearGradient(0, pathY - 20, 0, pathY + 20);
      pathGrad.addColorStop(0, '#2c2014');
      pathGrad.addColorStop(0.5, '#3a2a18');
      pathGrad.addColorStop(1, '#2c2014');
      ctx.fillStyle = pathGrad;
      // Horizontal main path
      ctx.fillRect(60, pathY - 20, width - 120, 40);
      // Vertical path
      ctx.fillRect(cx - 25, vy + 10, 50, vh - 20);
      // Center plaza
      ctx.beginPath(); ctx.arc(cx, pathY, 55, 0, Math.PI * 2); ctx.fill();

      // Cobblestone texture dots
      ctx.fillStyle = 'rgba(70,55,35,0.45)';
      for (let ci = 0; ci < 50; ci++) {
        const rx = 80 + (ci * 31 * 5) % (width - 160);
        const ry = pathY - 14 + (ci * 17) % 28;
        ctx.fillRect(rx, ry, 9, 6);
      }
      ctx.restore();

      // Central stone well
      drawWell(cx, pathY);

      // Notice board
      drawNoticeBoard(cx + 55, vy + 30);

      // Grass patches away from paths
      ctx.save();
      ctx.fillStyle = 'rgba(20,40,12,0.35)';
      for (let gi = 0; gi < 25; gi++) {
        const gx = 30 + (gi * 97) % (width - 60);
        const gy = vy + 20 + (gi * 61) % (vh - 40);
        const dist = Math.hypot(gx - cx, gy - pathY);
        if (dist > 70) {
          ctx.beginPath(); ctx.ellipse(gx, gy, 14 + gi % 8, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();

      // TAVERN — top-left village
      drawTavern(width * 0.08, vy + 4, width * 0.25, vh * 0.52);

      // BLACKSMITH FORGE — bottom-left
      drawForge(width * 0.06, vy + vh * 0.56, width * 0.24, vh * 0.42);

      // GUARD POST — top near barrier gate
      drawGuardPost(width * 0.36, vy + 6, width * 0.28, vh * 0.32);

      // ARCANE SANCTUM — right side
      drawSanctum(width * 0.68, vy + 4, width * 0.3, vh * 0.7);

      // Fireflies in village
      ctx.save();
      for (const ff of fireflies) {
        if (ff.inForest) continue;
        const pA = (Math.sin(ff.phase) + 1) / 2;
        ctx.fillStyle = `rgba(255,220,60,${pA * 0.7})`;
        ctx.beginPath(); ctx.arc(ff.x, ff.y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function drawWell(cx, cy) {
      ctx.save();
      ctx.fillStyle = '#1e1408';
      ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#122640';
      ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
      const rippleR = 5 + Math.sin(time * 0.05) * 5;
      ctx.strokeStyle = 'rgba(147,197,253,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rippleR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5c4030';
      ctx.fillRect(cx - 22, cy - 4, 44, 8);
      // Rope & bucket
      ctx.strokeStyle = '#78560f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy - 18); ctx.stroke();
      ctx.fillStyle = '#6b4530';
      ctx.fillRect(cx - 5, cy - 24, 10, 6);
      ctx.restore();
    }

    function drawNoticeBoard(bx, by) {
      ctx.save();
      ctx.fillStyle = '#4a3520'; ctx.fillRect(bx - 2, by, 4, 22);
      ctx.fillStyle = '#78350f'; ctx.fillRect(bx - 14, by - 4, 28, 16);
      ctx.fillStyle = '#d4b66a';
      ctx.font = '7px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText('NOTICE', bx, by + 6);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(bx - 10, by + 1, 9, 8);
      ctx.fillRect(bx + 2, by + 2, 8, 7);
      ctx.restore();
    }

    function drawTavern(x, y, w, h) {
      ctx.save();
      // Main building
      ctx.fillStyle = '#2a1a0c'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(245,158,11,0.3)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Roof
      ctx.fillStyle = '#3d200e';
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + w + 5, y); ctx.lineTo(x + w + 5, y + 12); ctx.lineTo(x - 5, y + 12); ctx.closePath(); ctx.fill();
      // Sign
      ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 7px Cinzel, serif'; ctx.textAlign = 'left';
      ctx.fillText('🍺 WHISPERING WILLOW', x + 4, y + 9);
      // Windows
      const lanternFlicker = 0.7 + Math.sin(time * 0.15) * 0.25;
      for (let wi = 0; wi < 2; wi++) {
        const wx = x + 10 + wi * 32;
        const wy = y + 22;
        const wGlow = ctx.createRadialGradient(wx + 9, wy + 10, 0, wx + 9, wy + 10, 30);
        wGlow.addColorStop(0, `rgba(245,158,11,${0.4 * lanternFlicker})`);
        wGlow.addColorStop(1, 'rgba(245,158,11,0)');
        ctx.fillStyle = wGlow;
        ctx.beginPath(); ctx.arc(wx + 9, wy + 10, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,220,80,${0.65 * lanternFlicker})`;
        ctx.fillRect(wx, wy, 18, 22);
        ctx.fillStyle = '#4a2a0a'; ctx.lineWidth = 1;
        ctx.strokeRect(wx, wy, 18, 22);
        ctx.beginPath(); ctx.moveTo(wx + 9, wy); ctx.lineTo(wx + 9, wy + 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx, wy + 11); ctx.lineTo(wx + 18, wy + 11); ctx.stroke();
      }
      // Door
      ctx.fillStyle = '#4a2a12';
      ctx.fillRect(x + w / 2 - 9, y + h - 26, 18, 26);
      ctx.fillStyle = '#2a1206';
      ctx.beginPath(); ctx.arc(x + w / 2, y + h - 26, 9, Math.PI, 0); ctx.fill();
      // Hanging lantern
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(x + w - 18, y + 16, 6, 9);
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + w - 15, y + 14); ctx.lineTo(x + w - 15, y + 16); ctx.stroke();
      ctx.restore();
    }

    function drawForge(x, y, w, h) {
      ctx.save();
      ctx.fillStyle = '#2d1410'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(239,68,68,0.3)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Roof overhang
      ctx.fillStyle = '#4a1a0a';
      ctx.fillRect(x - 4, y, w + 8, 10);
      // Sign
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 7px Cinzel, serif'; ctx.textAlign = 'left';
      ctx.fillText('🔨 HAVEN FORGE', x + 4, y + 8);
      // Forge fire
      const hFlick = 0.8 + Math.sin(time * 0.18) * 0.22;
      const hGlow = ctx.createRadialGradient(x + 22, y + h * 0.55, 0, x + 22, y + h * 0.55, 40);
      hGlow.addColorStop(0, `rgba(239,68,68,${0.7 * hFlick})`);
      hGlow.addColorStop(0.5, `rgba(245,158,11,${0.35 * hFlick})`);
      hGlow.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = hGlow;
      ctx.beginPath(); ctx.arc(x + 22, y + h * 0.55, 40, 0, Math.PI * 2); ctx.fill();
      // Anvil
      ctx.fillStyle = '#334155'; ctx.fillRect(x + w - 32, y + h - 22, 24, 14);
      ctx.fillStyle = '#475569'; ctx.fillRect(x + w - 30, y + h - 28, 20, 8);
      // Chimney
      ctx.fillStyle = '#1c0e08'; ctx.fillRect(x + w - 18, y - 14, 12, 18);
      ctx.fillStyle = `rgba(80,60,50,${0.4 + Math.sin(time * 0.1) * 0.2})`;
      ctx.beginPath(); ctx.arc(x + w - 12, y - 18 + Math.sin(time * 0.08) * 3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawGuardPost(x, y, w, h) {
      ctx.save();
      // Gate towers
      ctx.fillStyle = '#1e252e'; ctx.fillRect(x, y, 12, h);
      ctx.fillRect(x + w - 12, y, 12, h);
      ctx.fillRect(x, y, w, 16);
      // Gate arch
      ctx.fillStyle = '#141b22';
      ctx.beginPath(); ctx.arc(x + w / 2, y + 16, w * 0.28, 0, Math.PI, true); ctx.fill();
      ctx.fillRect(x + w * 0.22, y + 16, w * 0.56, h - 16);
      // Purple mist through gate
      const mistG = ctx.createLinearGradient(0, y + 16, 0, y + h);
      mistG.addColorStop(0, 'rgba(88,28,135,0.55)');
      mistG.addColorStop(1, 'rgba(20,14,28,0.15)');
      ctx.fillStyle = mistG;
      ctx.beginPath(); ctx.arc(x + w / 2, y + 16, w * 0.28, 0, Math.PI, true);
      ctx.lineTo(x + w * 0.22 + w * 0.56, y + h);
      ctx.lineTo(x + w * 0.22, y + h);
      ctx.closePath(); ctx.fill();
      // Gate torches
      for (const tx of [x + 2, x + w - 14]) {
        const tFlick = 0.8 + Math.sin(time * 0.2 + tx) * 0.2;
        const tGlow = ctx.createRadialGradient(tx + 6, y + 10, 0, tx + 6, y + 10, 28);
        tGlow.addColorStop(0, `rgba(249,115,22,${0.55 * tFlick})`);
        tGlow.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.fillStyle = tGlow; ctx.beginPath(); ctx.arc(tx + 6, y + 10, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffedd5'; ctx.fillRect(tx + 4, y + 7, 4, 7);
      }
      ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 7px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText('🛡️ BARRIER GATE', x + w / 2, y - 2);
      ctx.restore();
    }

    function drawSanctum(x, y, w, h) {
      ctx.save();
      ctx.fillStyle = '#1a0a28'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(168,85,247,0.3)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Domed roof
      const roofGrad = ctx.createLinearGradient(x + w / 2 - 30, y - 20, x + w / 2 + 30, y + 20);
      roofGrad.addColorStop(0, '#3b0764');
      roofGrad.addColorStop(1, '#581c87');
      ctx.fillStyle = roofGrad;
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + 4, w * 0.48, 28, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#9333ea'; ctx.font = 'bold 7px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText('🔮 ARCANE SANCTUM', x + w / 2, y - 4);
      // Rotating rune circle around elian
      const ex = typeof npcs.elian.x === 'function' ? npcs.elian.x() : npcs.elian.x;
      const ey = typeof npcs.elian.y === 'function' ? npcs.elian.y() : npcs.elian.y;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(npcs.elian.runeAngle);
      ctx.strokeStyle = 'rgba(168,85,247,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // Orb glow
      const eGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 60);
      eGlow.addColorStop(0, 'rgba(168,85,247,0.22)');
      eGlow.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = eGlow; ctx.beginPath(); ctx.arc(ex, ey, 60, 0, Math.PI * 2); ctx.fill();
      // Arcane barrier rift waves (at bottom of sanctum)
      ctx.strokeStyle = 'rgba(192,132,252,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let bx = x; bx <= x + w; bx += 4) {
        const by2 = y + h - 10 + Math.sin(bx * 0.05 + time * 0.08) * 5;
        if (bx === x) ctx.moveTo(bx, by2); else ctx.lineTo(bx, by2);
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawZoneLabels() {
      ctx.save(); ctx.globalAlpha = 0.55;
      // Forest label
      ctx.fillStyle = 'rgba(60,200,80,0.9)';
      ctx.font = 'bold 11px Cinzel, serif'; ctx.textAlign = 'left';
      ctx.shadowBlur = 8; ctx.shadowColor = '#40c860';
      ctx.fillText('🌲 THE ANCIENT FOREST', 14, 20);
      // Barrier label
      const bMid = barrierY() + barrierH() / 2 + 4;
      ctx.fillStyle = 'rgba(200,140,255,0.95)';
      ctx.shadowColor = '#c080ff';
      ctx.font = 'bold 9px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText('✦ THE MAGICAL BARRIER ✦', width / 2, bMid);
      // Village label
      ctx.fillStyle = 'rgba(201,168,76,0.9)';
      ctx.shadowColor = '#c9a84c';
      ctx.font = 'bold 11px Cinzel, serif'; ctx.textAlign = 'left';
      ctx.fillText('🏰 HAVEN VILLAGE', 14, villageY() + 18);
      ctx.restore();
    }

    function drawHotspotRings() {
      for (const h of HOTSPOTS) {
        const hx = h.x * (width / 760);
        const hy = barrierY() + h.y * (villageH() / 330);
        if (nearHotspot && nearHotspot.id === h.id) {
          ctx.save();
          ctx.strokeStyle = 'rgba(201,168,76,0.6)'; ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.arc(hx, hy, h.radius, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }
    }

    function drawAtmosphere() {
      const currentTod = timeOfDayRef.current;
      if (currentTod === 'day') {
        // Slight vignette
        const vig = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = vig; ctx.fillRect(0, 0, width, height);
        return;
      }

      ctx.save();
      const darkness = currentTod === 'night' ? 0.72 : 0.4;
      ctx.fillStyle = currentTod === 'night' ? `rgba(4,5,14,${darkness})` : `rgba(20,12,6,${darkness})`;
      ctx.fillRect(0, villageY(), width, villageH());

      // Only carve light in village zone
      ctx.globalCompositeOperation = 'destination-out';

      // Tavern lantern
      const lFlick = 0.85 + Math.sin(time * 0.12) * 0.15;
      addLight(width * 0.21, villageY() + villageH() * 0.2, 100 * lFlick);

      // Forge fire
      addLight(width * 0.16, villageY() + villageH() * 0.72, 85);

      // Elian orb
      const ex = typeof npcs.elian.x === 'function' ? npcs.elian.x() : npcs.elian.x;
      const ey = typeof npcs.elian.y === 'function' ? npcs.elian.y() : npcs.elian.y;
      addLight(ex, ey, 100);

      // Gate torches
      const gpX = width * 0.5;
      const gpY = villageY() + 14;
      addLight(gpX - width * 0.14, gpY, 60);
      addLight(gpX + width * 0.14, gpY, 60);

      // Player torch
      addLight(player.x, player.y - 10, 65);

      ctx.restore();

      // Village fireflies with glow
      ctx.save();
      for (const ff of fireflies) {
        if (ff.inForest) continue;
        const pA = (Math.sin(ff.phase) + 1) / 2;
        ctx.fillStyle = `rgba(255,204,21,${pA * 0.85})`;
        ctx.shadowBlur = 6; ctx.shadowColor = '#ffcc15';
        ctx.beginPath(); ctx.arc(ff.x, ff.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function addLight(lx, ly, r) {
      const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      light.addColorStop(0, 'rgba(0,0,0,0.8)');
      light.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      light.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = light;
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill();
    }

    function drawProximityRing(x, y, isNear) {
      if (!isNear) return;
      ctx.save();
      const pulse = 1 + Math.sin(time * 0.1) * 0.15;
      const r = 26 * pulse;
      ctx.strokeStyle = 'rgba(201,168,76,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 8, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(201,168,76,0.14)'; ctx.fill();
      ctx.restore();
    }

    function drawNpc(npc) {
      const x = typeof npc.x === 'function' ? npc.x() : npc.x;
      const y = typeof npc.y === 'function' ? npc.y() : npc.y;
      drawHumanSprite({ ...npc, x, y });
    }

    function drawPlayer() {
      drawHumanSprite({ ...player, name: 'Ramu', role: 'Adventurer', isPlayer: true });
    }

    function drawHumanSprite(char) {
      const { x, y, isPlayer = false, isMoving = false, walkCycle = 0, frame = 0, breath = 0, dir = 'down', blinkTimer } = char;
      const cycle = walkCycle || frame;
      ctx.save();

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(x, y + 10, 11, 5, 0, 0, Math.PI * 2); ctx.fill();

      // Legs
      const legSwing = isMoving ? Math.sin(cycle) * 5 : 0;
      const pantColor   = isPlayer ? '#4a3525' : (char.id === 'rowan' ? '#334155' : '#3e2723');
      const bootColor   = isPlayer ? '#3e2723' : (char.id === 'rowan' ? '#475569' : '#2d1f18');
      ctx.fillStyle = pantColor;
      ctx.fillRect(x - 6, y + 2 - legSwing, 4, 8 + legSwing);
      ctx.fillStyle = bootColor; ctx.fillRect(x - 7, y + 8, 5, 4);
      ctx.fillStyle = pantColor;
      ctx.fillRect(x + 2, y + 2 + legSwing, 4, 8 - legSwing);
      ctx.fillStyle = bootColor; ctx.fillRect(x + 2, y + 8, 5, 4);

      // Cape/cloak
      if (isPlayer) {
        ctx.fillStyle = '#1e3a8a';
        const wave = Math.sin(time * 0.1) * 3;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y - 8);
        ctx.lineTo(x + 10 + wave, y + 6); ctx.lineTo(x - 10 - wave, y + 6);
        ctx.closePath(); ctx.fill();
      } else if (char.id === 'elian') {
        ctx.fillStyle = '#4c1d95';
        const rw = Math.sin(time * 0.08) * 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 6); ctx.lineTo(x + 8, y - 6);
        ctx.lineTo(x + 9 + rw, y + 8); ctx.lineTo(x - 9 - rw, y + 8);
        ctx.closePath(); ctx.fill();
      }

      // Torso
      const torsoY = y - 9 + breath;
      if (isPlayer) {
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(x - 7, torsoY, 14, 12);
        ctx.fillStyle = '#b45309'; ctx.fillRect(x - 7, torsoY + 8, 14, 3);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(x - 2, torsoY + 8, 4, 3);
      } else if (char.id === 'mira') {
        ctx.fillStyle = '#991b1b'; ctx.fillRect(x - 6, torsoY + 1, 12, 11);
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(x - 4, torsoY + 4, 8, 8);
        ctx.fillStyle = '#78350f'; ctx.fillRect(x - 6, torsoY + 4, 12, 2);
      } else if (char.id === 'rowan') {
        const ag = ctx.createLinearGradient(x - 7, torsoY, x + 7, torsoY);
        ag.addColorStop(0, '#475569'); ag.addColorStop(0.5, '#cbd5e1'); ag.addColorStop(1, '#475569');
        ctx.fillStyle = ag; ctx.fillRect(x - 8, torsoY, 16, 12);
        ctx.fillStyle = '#1d4ed8'; ctx.fillRect(x - 3, torsoY, 6, 12);
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(x - 1, torsoY + 3, 2, 3);
      } else if (char.id === 'aldric') {
        ctx.fillStyle = '#d97706'; ctx.fillRect(x - 7, torsoY + 1, 14, 11);
        ctx.fillStyle = '#451a03'; ctx.fillRect(x - 6, torsoY + 1, 2, 9); ctx.fillRect(x + 4, torsoY + 1, 2, 9);
      } else if (char.id === 'elian') {
        ctx.fillStyle = '#6b21a8'; ctx.fillRect(x - 7, torsoY, 14, 13);
        ctx.fillStyle = '#e9d5ff'; ctx.fillRect(x - 1, torsoY, 2, 13);
      }

      // Head
      const headY = y - 14 + breath * 0.5;
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath(); ctx.arc(x, headY, 6.5, 0, Math.PI * 2); ctx.fill();

      // Eyes
      let eyeOffX = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
      const isBlinking = isPlayer && blinkTimer < 8;
      if (!isBlinking && dir !== 'up') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 2.5 + eyeOffX, headY - 1, 1.5, 2);
        ctx.fillRect(x + 1 + eyeOffX, headY - 1, 1.5, 2);
      }

      // Hair & hats
      if (isPlayer) {
        ctx.fillStyle = '#451a03'; ctx.fillRect(x - 6.5, headY - 6.5, 13, 5);
        ctx.fillStyle = '#15803d'; ctx.fillRect(x - 7, headY - 3, 14, 2);
      } else if (char.id === 'mira') {
        ctx.fillStyle = '#b45309';
        ctx.beginPath(); ctx.arc(x, headY - 2, 7.5, Math.PI, 0); ctx.fill();
        ctx.fillRect(x + 4, headY - 1, 3.5, 8);
        ctx.fillStyle = '#dc2626'; ctx.fillRect(x + 4, headY + 5, 3.5, 2);
      } else if (char.id === 'rowan') {
        ctx.fillStyle = '#64748b'; ctx.fillRect(x - 7.5, headY - 7, 15, 6.5);
        ctx.fillStyle = '#dc2626'; ctx.fillRect(x - 2, headY - 10, 4, 4);
      } else if (char.id === 'aldric') {
        ctx.fillStyle = '#3e2723'; ctx.fillRect(x - 6.5, headY - 6, 13, 4);
        ctx.fillStyle = '#1c1917'; ctx.fillRect(x - 4, headY + 2, 8, 5);
      } else if (char.id === 'elian') {
        ctx.fillStyle = '#581c87';
        ctx.beginPath(); ctx.moveTo(x - 8, headY - 1); ctx.lineTo(x + 8, headY - 1); ctx.lineTo(x, headY - 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x - 3, headY + 2, 6, 6);
      }

      // Hand props
      if (char.id === 'mira') {
        ctx.fillStyle = '#78350f'; ctx.fillRect(x + 7, y - 6, 5, 7);
        ctx.fillStyle = '#fef08a'; ctx.fillRect(x + 7, y - 8, 5, 2);
      } else if (char.id === 'rowan') {
        ctx.fillStyle = '#1e40af';
        ctx.beginPath(); ctx.moveTo(x - 13, y - 7); ctx.lineTo(x - 5, y - 7); ctx.lineTo(x - 9, y + 5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 8, y - 2); ctx.lineTo(x + 14, y - 10); ctx.stroke();
      } else if (char.id === 'aldric') {
        ctx.save(); ctx.translate(x + 8, y - 4);
        const hAngle = char.hammerDown ? 0.8 : -0.6;
        ctx.rotate(hAngle);
        ctx.fillStyle = '#78350f'; ctx.fillRect(0, -2, 10, 3);
        ctx.fillStyle = '#475569'; ctx.fillRect(8, -6, 5, 11);
        ctx.restore();
      } else if (char.id === 'elian') {
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 9, y + 8); ctx.lineTo(x + 9, y - 20); ctx.stroke();
        ctx.fillStyle = '#d8b4fe'; ctx.beginPath(); ctx.arc(x + 9, y - 21, 4, 0, Math.PI * 2); ctx.fill();
        const bBob = char.bookBob || 0;
        ctx.fillStyle = '#4c1d95'; ctx.fillRect(x - 16, y - 14 + bBob, 8, 10);
        ctx.fillStyle = '#fef08a'; ctx.fillRect(x - 15, y - 13 + bBob, 6, 8);
      }

      // Name tag
      ctx.textAlign = 'center';
      if (isPlayer) {
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText('⚔️ Ramu (You)', x, y - 28);
      } else {
        ctx.fillStyle = char.color || '#d4af37'; ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText(`${char.moodIcon || ''} ${char.name}`, x, y - 28);
        ctx.fillStyle = 'rgba(226,232,240,0.75)'; ctx.font = 'italic 7.5px Inter, sans-serif';
        ctx.fillText(char.mood || char.role, x, y - 20);
      }

      ctx.restore();
    }

    function drawSpeechBubble(b) {
      ctx.save();
      ctx.font = '11px Inter, sans-serif';
      const textW = Math.min(220, ctx.measureText(b.text).width + 20);
      const boxW = Math.max(80, textW), boxH = 26;
      const bx = Math.max(5, Math.min(width - boxW - 5, b.x - boxW / 2));
      const by = Math.max(5, b.y - boxH);
      const alpha = Math.min(1, b.life / 30);
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = 'rgba(18,14,8,0.95)';
      ctx.strokeStyle = 'rgba(201,168,76,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 6); else ctx.rect(bx, by, boxW, boxH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(18,14,8,0.95)';
      ctx.beginPath(); ctx.moveTo(b.x - 5, by + boxH); ctx.lineTo(b.x + 5, by + boxH); ctx.lineTo(b.x, by + boxH + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f5ead8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.text.slice(0, 40) + (b.text.length > 40 ? '…' : ''), bx + boxW / 2, by + boxH / 2);
      ctx.restore();
    }

    function drawMiniMap() {
      ctx.save();
      const mapR = 32, mx = width - 42, my = 42;
      ctx.fillStyle = 'rgba(12,10,18,0.9)';
      ctx.strokeStyle = 'rgba(201,168,76,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, mapR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      const sx = (mapR * 1.6) / width;
      const sy = (mapR * 1.6) / height;

      for (const npc of Object.values(npcs)) {
        const nx2 = typeof npc.x === 'function' ? npc.x() : npc.x;
        const ny2 = typeof npc.y === 'function' ? npc.y() : npc.y;
        ctx.fillStyle = npc.color;
        ctx.beginPath(); ctx.arc(mx - mapR * 0.8 + nx2 * sx, my - mapR * 0.8 + ny2 * sy, 3, 0, Math.PI * 2); ctx.fill();
      }
      const px = mx - mapR * 0.8 + player.x * sx;
      const py = my - mapR * 0.8 + player.y * sy;
      const pulse = 3 + Math.sin(time * 0.15) * 1.2;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(px, py, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function gameLoop() {
      time++;
      update();
      render();
      animId = requestAnimationFrame(gameLoop);
    }

    function onPromptClick() {
      if (nearNpc) {
        selectedNpcRef.current = nearNpc.id;
        if (onSelectNpcRef.current) onSelectNpcRef.current(nearNpc.id);
        if (onOpenChatInputRef.current) onOpenChatInputRef.current();
      }
    }
    if (promptEl) promptEl.addEventListener('click', onPromptClick);

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
      if (promptEl) promptEl.removeEventListener('click', onPromptClick);
    };
  }, [gameWorldRef]);

  function cycleTimeOfDay() {
    setTimeOfDay(prev => prev === 'dusk' ? 'night' : prev === 'night' ? 'day' : 'dusk');
  }

  return (
    <div ref={containerRef} className="game-world-container" id="game-world-container">
      <canvas ref={canvasRef} className="world-canvas" id="world-canvas" />

      <div className="world-overlay-bar">
        <div className="world-pill">
          <span>🏰 Haven Map (Live)</span>
          <span style={{ opacity: 0.35 }}>|</span>
          <span style={{ color: 'var(--gold-light)' }}>
            WASD/Arrows • Shift Sprint • [E] Talk • Click NPC
          </span>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button className="world-btn" onClick={cycleTimeOfDay} id="tod-btn">
            {timeOfDay === 'day' ? '☀️ Day' : timeOfDay === 'night' ? '🌙 Night' : '🌅 Dusk'}
          </button>
          <button className="world-btn" onClick={() => setAudioEnabled(p => !p)} id="audio-btn">
            {audioEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      <div ref={promptRef} className="interact-prompt" id="interact-prompt">
        Press [E] to Speak
      </div>
    </div>
  );
}
