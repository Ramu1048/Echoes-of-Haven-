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
  const canvasRef = useRef(null);
  const promptRef = useRef(null);

  const [timeOfDay, setTimeOfDay] = useState('dusk');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const promptEl = promptRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    let animId = null;
    let audioCtx = null;
    let time = 0;
    const keys = {};

    // World Dimensions
    let width = container.clientWidth || 760;
    let height = container.clientHeight || 330;

    function resize() {
      if (!container || !canvas) return;
      width = container.clientWidth || 760;
      height = container.clientHeight || 330;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    // Human Player
    const player = {
      x: 390, y: 175,
      targetX: null, targetY: null,
      speed: 3.0,
      sprintMult: 1.0,
      dir: 'down',
      walkCycle: 0,
      isMoving: false,
      color: '#4ade80',
      breath: 0,
      blinkTimer: 100
    };

    // 4 Dynamic Living NPCs
    const npcs = {
      mira: {
        id: 'mira', name: 'Mira', role: 'Tavern Keeper',
        x: 155, y: 105, color: '#f59e0b', dir: 'down',
        mood: 'Pouring Ale', moodIcon: '🍺',
        hairColor: '#b45309', clothesColor: '#991b1b',
        frame: 0, breath: 0,
        barks: [
          "Careful travellers... the shadows grow long.",
          "Another pint of spiced mead, freshly tapped.",
          "Keep your secrets close, walls have ears here."
        ],
        barkTimer: 280
      },
      rowan: {
        id: 'rowan', name: 'Rowan', role: 'Guard Captain',
        x: 640, y: 105, color: '#3b82f6', dir: 'left',
        mood: 'Sentry Patrol', moodIcon: '🛡️',
        patrolX: 640, patrolMin: 590, patrolMax: 690, patrolDir: -0.7,
        frame: 0, breath: 0.5, alertState: false,
        hairColor: '#475569', clothesColor: '#334155',
        barks: [
          "Halt! State your business in Haven.",
          "The tree line is restless tonight. Stay alert.",
          "No one enters the Forbidden Forest without decree."
        ],
        barkTimer: 400
      },
      aldric: {
        id: 'aldric', name: 'Aldric', role: 'Blacksmith',
        x: 160, y: 240, color: '#ef4444', dir: 'right',
        mood: 'Forging Steel', moodIcon: '🔨',
        hammerTimer: 0, hammerDown: false,
        frame: 0, breath: 1.0,
        hairColor: '#271c19', clothesColor: '#d97706',
        barks: [
          "Pure iron requires heat and conviction.",
          "A good blade remembers the hand that forged it.",
          "The furnace coals are glowing true."
        ],
        barkTimer: 340
      },
      elian: {
        id: 'elian', name: 'Elian', role: 'Mage',
        x: 635, y: 240, color: '#a855f7', dir: 'down',
        mood: 'Weaving Wards', moodIcon: '🔮',
        runeAngle: 0, frame: 0, breath: 1.5,
        hairColor: '#e2e8f0', clothesColor: '#6b21a8',
        bookBob: 0,
        barks: [
          "The ancient ley barrier is fraying at the edges...",
          "Runes of haven... heed my chant.",
          "Darkness bleeds from the rift beyond the woods."
        ],
        barkTimer: 460
      }
    };

    let nearNpc = null;
    let nearHotspot = null;
    const particles = [];
    const dustPuffs = [];
    const fireflies = [];
    const wisps = [];
    let speechBubbles = [];

    // Ambient night fireflies
    for (let i = 0; i < 28; i++) {
      fireflies.push({
        x: Math.random() * 800,
        y: Math.random() * 330,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Audio SFX
    function playSfx(type) {
      if (!audioEnabled) return;
      try {
        if (!audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) audioCtx = new AudioCtx();
        }
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'step') {
          osc.frequency.setValueAtTime(160 + (time % 2 === 0 ? 30 : -20), now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === 'anvil') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1180, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.28);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);
        } else if (type === 'magic') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.linearRampToValueAtTime(783.99, now + 0.3);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
        }
      } catch (e) {}
    }

    // Expose methods to parent React ref
    if (gameWorldRef) {
      gameWorldRef.current = {
        walkPlayerToNpc: (npcId) => {
          const npc = npcs[npcId];
          if (npc) {
            player.targetX = npc.x + (npc.x < width / 2 ? 46 : -46);
            player.targetY = npc.y + 10;
          }
        },
        showSpeechBubble: (charId, text) => {
          let source = charId === "player" ? player : npcs[charId];
          if (!source) source = npcs.mira;
          const cleanText = text.replace(/<[^>]*>?/gm, '').slice(0, 95) + (text.length > 95 ? "…" : "");
          speechBubbles = speechBubbles.filter((b) => b.charId !== charId);
          speechBubbles.push({
            charId,
            text: cleanText,
            x: source.x,
            y: source.y - 52,
            life: 380,
            maxLife: 380
          });
        },
        triggerGossipFx: (fromNpcId) => {
          const fromNpc = npcs[fromNpcId] || npcs.mira;
          const toNpc = fromNpcId === "rowan" ? npcs.mira : npcs.rowan;
          playSfx('magic');
          wisps.push({
            x: fromNpc.x,
            y: fromNpc.y - 20,
            targetX: toNpc.x,
            targetY: toNpc.y - 20,
            targetNpc: toNpc,
            progress: 0,
            speed: 0.015
          });
          if (fromNpcId === "mira") {
            npcs.mira.mood = "Whispering Secrets";
            npcs.mira.moodIcon = "🤫";
          }
        },
        triggerActionFx: (action) => {
          if (action.action === "craft_item") {
            playSfx('anvil');
            npcs.aldric.mood = "Blade Forged";
            npcs.aldric.moodIcon = "✨";
            for (let i = 0; i < 50; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 2 + Math.random() * 5.5;
              particles.push({
                x: 185, y: 245,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 2.8,
                life: 45 + Math.random() * 25,
                color: Math.random() > 0.3 ? '#f59e0b' : '#fbbf24',
                size: 2.5 + Math.random() * 3
              });
            }
          } else {
            playSfx('magic');
            for (let i = 0; i < 30; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 1.2 + Math.random() * 2.8;
              particles.push({
                x: player.x, y: player.y - 15,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 1.2,
                life: 40 + Math.random() * 20,
                color: '#60a5fa',
                size: 2.5 + Math.random() * 2
              });
            }
          }
        }
      };
    }

    // Keyboard events
    function onKeyDown(e) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Shift') player.sprintMult = 1.7;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keys[e.key] = true;
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'e') {
        if (nearNpc) {
          onSelectNpc(nearNpc.id);
          onOpenChatInput();
        }
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (nearHotspot) {
          onInspectHotspot(nearHotspot);
          playSfx('magic');
        } else if (nearNpc) {
          onSelectNpc(nearNpc.id);
          onOpenChatInput();
        }
      }
    }

    function onKeyUp(e) {
      keys[e.key.toLowerCase()] = false;
      if (e.key === 'Shift') player.sprintMult = 1.0;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keys[e.key] = false;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Canvas click
    function onCanvasClick(e) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let clickedNpc = null;
      for (const npc of Object.values(npcs)) {
        if (Math.hypot(clickX - npc.x, clickY - npc.y) < 38) {
          clickedNpc = npc;
          break;
        }
      }

      if (clickedNpc) {
        player.targetX = clickedNpc.x + (clickedNpc.x > player.x ? -36 : 36);
        player.targetY = clickedNpc.y + 10;
        onSelectNpc(clickedNpc.id);
      } else {
        let clickedHotspot = null;
        for (const h of HOTSPOTS) {
          if (Math.hypot(clickX - h.x, clickY - h.y) < h.radius) {
            clickedHotspot = h;
            break;
          }
        }
        if (clickedHotspot) {
          player.targetX = clickedHotspot.x;
          player.targetY = clickedHotspot.y + 20;
          onInspectHotspot(clickedHotspot);
        } else {
          player.targetX = clickX;
          player.targetY = clickY;
        }
      }
    }
    canvas.addEventListener('click', onCanvasClick);

    // Main Game Loop
    function update() {
      // 1. Move Player
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      const actualSpeed = player.speed * player.sprintMult;

      if (dx !== 0 || dy !== 0) {
        player.targetX = null;
        player.targetY = null;
        const len = Math.hypot(dx, dy);
        player.x += (dx / len) * actualSpeed;
        player.y += (dy / len) * actualSpeed;
        player.isMoving = true;
        player.walkCycle += 0.22 * player.sprintMult;

        if (time % (player.sprintMult > 1.2 ? 12 : 18) === 0) {
          playSfx('step');
          dustPuffs.push({
            x: player.x + (Math.random() - 0.5) * 6,
            y: player.y + 12,
            life: 14,
            maxLife: 14,
            r: 2 + Math.random() * 2
          });
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          player.dir = dx > 0 ? 'right' : 'left';
        } else {
          player.dir = dy > 0 ? 'down' : 'up';
        }
      } else if (player.targetX !== null && player.targetY !== null) {
        const tdx = player.targetX - player.x;
        const tdy = player.targetY - player.y;
        const dist = Math.hypot(tdx, tdy);
        if (dist > 3) {
          player.x += (tdx / dist) * actualSpeed;
          player.y += (tdy / dist) * actualSpeed;
          player.isMoving = true;
          player.walkCycle += 0.22 * player.sprintMult;
          if (time % 18 === 0) playSfx('step');
          if (Math.abs(tdx) > Math.abs(tdy)) {
            player.dir = tdx > 0 ? 'right' : 'left';
          } else {
            player.dir = tdy > 0 ? 'down' : 'up';
          }
        } else {
          player.targetX = null;
          player.targetY = null;
          player.isMoving = false;
        }
      } else {
        player.isMoving = false;
      }

      player.x = Math.max(35, Math.min(width - 35, player.x));
      player.y = Math.max(75, Math.min(height - 35, player.y));
      player.breath = Math.sin(time * 0.05);

      player.blinkTimer--;
      if (player.blinkTimer <= 0) player.blinkTimer = 180 + Math.random() * 100;

      // 2. Animate Dynamic NPCs
      for (const npc of Object.values(npcs)) {
        npc.breath = Math.sin(time * 0.05 + npc.x);

        npc.barkTimer--;
        if (npc.barkTimer <= 0) {
          npc.barkTimer = 480 + Math.random() * 320;
          const randomBark = npc.barks[Math.floor(Math.random() * npc.barks.length)];
          if (gameWorldRef?.current?.showSpeechBubble) {
            gameWorldRef.current.showSpeechBubble(npc.id, randomBark);
          }
        }

        const distToPlayer = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (distToPlayer < 100) {
          const adx = player.x - npc.x;
          const ady = player.y - npc.y;
          if (Math.abs(adx) > Math.abs(ady)) {
            npc.dir = adx > 0 ? 'right' : 'left';
          } else {
            npc.dir = ady > 0 ? 'down' : 'up';
          }
        }
      }

      // Rowan sentry patrol
      const rowan = npcs.rowan;
      if (!rowan.alertState) {
        rowan.x += rowan.patrolDir;
        if (rowan.x <= rowan.patrolMin) {
          rowan.patrolDir = 0.65;
          rowan.dir = 'right';
        } else if (rowan.x >= rowan.patrolMax) {
          rowan.patrolDir = -0.65;
          rowan.dir = 'left';
        }
      }
      rowan.frame += 0.12;

      // Aldric hammer strikes with spark particles & cooling steam
      const aldric = npcs.aldric;
      aldric.hammerTimer = (aldric.hammerTimer + 1) % 150;
      if (aldric.hammerTimer === 75) {
        aldric.hammerDown = true;
        playSfx('anvil');
        for (let i = 0; i < 9; i++) {
          particles.push({
            x: aldric.x + 20, y: aldric.y + 6,
            vx: (Math.random() - 0.5) * 3.8,
            vy: -Math.random() * 3.2 - 0.5,
            life: 25 + Math.random() * 15,
            color: '#fbbf24',
            size: 2.2
          });
        }
      } else if (aldric.hammerTimer === 135) {
        for (let i = 0; i < 5; i++) {
          particles.push({
            x: 205 + (Math.random() - 0.5) * 8, y: 245,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -1.2 - Math.random() * 1.0,
            life: 30,
            color: 'rgba(226, 232, 240, 0.45)',
            size: 3.5
          });
        }
      } else if (aldric.hammerTimer > 92) {
        aldric.hammerDown = false;
      }

      npcs.elian.runeAngle += 0.02;
      npcs.elian.bookBob = Math.sin(time * 0.08) * 3;

      // Fireflies motion
      for (const ff of fireflies) {
        ff.phase += 0.05;
        ff.x += ff.vx + Math.sin(ff.phase) * 0.35;
        ff.y += ff.vy + Math.cos(ff.phase) * 0.35;
        if (ff.x < 10) ff.x = width - 20;
        if (ff.x > width - 10) ff.x = 20;
        if (ff.y < 30) ff.y = height - 20;
        if (ff.y > height - 10) ff.y = 40;
      }

      // Proximity check
      let closestNpc = null;
      let closestNpcDist = 65;
      for (const npc of Object.values(npcs)) {
        const d = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (d < closestNpcDist) {
          closestNpc = npc;
          closestNpcDist = d;
        }
      }
      nearNpc = closestNpc;

      let closestHotspot = null;
      let closestHotspotDist = 50;
      for (const h of HOTSPOTS) {
        const d = Math.hypot(player.x - h.x, player.y - h.y);
        if (d < closestHotspotDist) {
          closestHotspot = h;
          closestHotspotDist = d;
        }
      }
      nearHotspot = closestHotspot;

      if (promptEl) {
        if (closestNpc) {
          promptEl.style.display = 'block';
          promptEl.style.left = `${closestNpc.x}px`;
          promptEl.style.top = `${closestNpc.y - 44}px`;
          promptEl.textContent = `[E] Speak with ${closestNpc.name} (${closestNpc.mood})`;
        } else if (closestHotspot) {
          promptEl.style.display = 'block';
          promptEl.style.left = `${closestHotspot.x}px`;
          promptEl.style.top = `${closestHotspot.y - 32}px`;
          promptEl.textContent = `[Space] Inspect ${closestHotspot.name}`;
        } else {
          promptEl.style.display = 'none';
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Dust puffs
      for (let i = dustPuffs.length - 1; i >= 0; i--) {
        const dp = dustPuffs[i];
        dp.life--;
        dp.r += 0.2;
        if (dp.life <= 0) dustPuffs.splice(i, 1);
      }

      // Wisps
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.progress += w.speed;
        w.x = w.x + (w.targetX - w.x) * w.speed * 4;
        w.y = w.y + (w.targetY - w.y) * w.speed * 4;

        if (time % 2 === 0) {
          particles.push({
            x: w.x, y: w.y,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            life: 25,
            color: Math.random() > 0.5 ? '#c084fc' : '#f59e0b',
            size: 3
          });
        }

        if (w.progress >= 1 || Math.hypot(w.targetX - w.x, w.targetY - w.y) < 16) {
          if (gameWorldRef?.current?.showSpeechBubble) {
            gameWorldRef.current.showSpeechBubble(w.targetNpc.id, "(!) Mira sent word...");
          }
          if (w.targetNpc.id === "rowan") {
            rowan.alertState = true;
            rowan.mood = "High Alert (Informed)";
            rowan.moodIcon = "⚔️";
          }
          wisps.splice(i, 1);
        }
      }

      // Speech bubbles
      for (let i = speechBubbles.length - 1; i >= 0; i--) {
        const b = speechBubbles[i];
        b.life--;
        const source = b.charId === "player" ? player : npcs[b.charId];
        if (source) {
          b.x = source.x;
          b.y = source.y - 52;
        }
        if (b.life <= 0) speechBubbles.splice(i, 1);
      }
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      // 1. Terrain Ground
      renderVillageGround();

      // 2. Props & Buildings
      renderVillageProps();

      // 3. Hotspot Outlines
      renderHotspots();

      // 4. Dust Puffs
      for (const dp of dustPuffs) {
        ctx.fillStyle = `rgba(168, 142, 114, ${dp.life / dp.maxLife * 0.35})`;
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, dp.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. NPCs
      for (const npc of Object.values(npcs)) {
        const isNear = nearNpc && nearNpc.id === npc.id;
        drawProximityRing(npc.x, npc.y, isNear);
        drawDetailedHumanSprite(npc);
      }

      // 6. Player (Ramu)
      drawDetailedHumanSprite({
        ...player,
        name: 'Ramu',
        role: 'Adventurer',
        isPlayer: true
      });

      // 7. Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 8. Gossip Wisps
      for (const wisp of wisps) {
        ctx.save();
        const glow = ctx.createRadialGradient(wisp.x, wisp.y, 0, wisp.x, wisp.y, 18);
        glow.addColorStop(0, 'rgba(243, 232, 255, 0.95)');
        glow.addColorStop(0.5, 'rgba(192, 132, 252, 0.6)');
        glow.addColorStop(1, 'rgba(192, 132, 252, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(wisp.x, wisp.y, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(wisp.x, wisp.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 9. Atmospheric Lighting
      renderAtmosphericLighting();

      // 10. Speech Bubbles
      for (const b of speechBubbles) {
        renderSpeechBubble(b);
      }

      // 11. Radar Mini-Map
      renderMiniMap();
    }

    function renderVillageGround() {
      ctx.fillStyle = "#130f0a";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2 + 10;

      const pathGrad = ctx.createLinearGradient(0, cy - 26, 0, cy + 26);
      pathGrad.addColorStop(0, "#2c2217");
      pathGrad.addColorStop(0.5, "#3b2e20");
      pathGrad.addColorStop(1, "#2c2217");

      ctx.fillStyle = pathGrad;
      ctx.fillRect(80, cy - 25, width - 160, 50);
      ctx.fillRect(cx - 30, 40, 60, height - 70);

      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fill();

      // Central Stone Fountain/Well
      ctx.save();
      ctx.fillStyle = "#1e1710";
      ctx.beginPath();
      ctx.arc(cx, cy, 27, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(201, 168, 76, 0.55)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#122a45";
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();

      const rippleR = 6 + (Math.sin(time * 0.05) * 6 + 6);
      ctx.strokeStyle = "rgba(147, 197, 253, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#5c4733";
      ctx.fillRect(cx - 24, cy - 4, 48, 8);
      ctx.restore();

      // Notice board
      ctx.fillStyle = "#4a3520";
      ctx.fillRect(cx - 2, 85, 4, 25);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(cx - 14, 75, 28, 16);
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(cx - 10, 78, 10, 10);
      ctx.fillRect(cx + 2, 79, 8, 8);

      // Cobblestone patches
      ctx.fillStyle = "rgba(75, 60, 42, 0.4)";
      for (let i = 0; i < 35; i++) {
        const rx = 90 + (i * 27 * 7) % (width - 180);
        const ry = cy - 18 + (i * 13) % 36;
        ctx.fillRect(rx, ry, 8, 6);
      }
    }

    function renderVillageProps() {
      // Tavern (Mira)
      ctx.save();
      ctx.fillStyle = "#2a1e12";
      ctx.fillRect(80, 50, 140, 80);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
      ctx.strokeRect(80, 50, 140, 80);

      ctx.fillStyle = "#3d2a19";
      ctx.fillRect(75, 42, 150, 12);
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 9px Cinzel, serif";
      ctx.fillText("🍺 TAVERN (WHISPERING WILLOW)", 85, 38);

      const lanternFlicker = 0.75 + Math.sin(time * 0.15) * 0.2;
      const lGlow = ctx.createRadialGradient(200, 70, 0, 200, 70, 50);
      lGlow.addColorStop(0, `rgba(245, 158, 11, ${0.45 * lanternFlicker})`);
      lGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = lGlow;
      ctx.beginPath();
      ctx.arc(200, 70, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffd54f";
      ctx.fillRect(197, 66, 6, 8);
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(195, 63, 10, 3);

      ctx.fillStyle = "#4a3520";
      ctx.fillRect(130, 115, 55, 14);
      ctx.fillStyle = "#5c4033";
      ctx.beginPath();
      ctx.arc(88, 118, 7, 0, Math.PI * 2);
      ctx.arc(104, 118, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Forest Gate (Rowan)
      ctx.save();
      ctx.fillStyle = "#262b33";
      ctx.fillRect(570, 48, 140, 22);
      ctx.fillRect(570, 70, 18, 55);
      ctx.fillRect(692, 70, 18, 55);

      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 9px Cinzel, serif";
      ctx.fillText("🛡️ FORBIDDEN FOREST GATE", 575, 38);

      const fMist = ctx.createLinearGradient(588, 48, 588, 95);
      fMist.addColorStop(0, "rgba(88, 28, 135, 0.55)");
      fMist.addColorStop(1, "rgba(20, 14, 28, 0.15)");
      ctx.fillStyle = fMist;
      ctx.fillRect(588, 70, 104, 55);

      for (const tx of [575, 705]) {
        const tFlick = 0.8 + Math.sin(time * 0.2 + tx) * 0.2;
        const tGlow = ctx.createRadialGradient(tx, 72, 0, tx, 72, 32);
        tGlow.addColorStop(0, `rgba(249, 115, 22, ${0.55 * tFlick})`);
        tGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = tGlow;
        ctx.beginPath();
        ctx.arc(tx, 72, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffedd5";
        ctx.fillRect(tx - 2, 70, 4, 6);
      }
      ctx.restore();

      // Blacksmith Forge (Aldric)
      ctx.save();
      ctx.fillStyle = "#2d1a14";
      ctx.fillRect(80, 200, 140, 78);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 9px Cinzel, serif";
      ctx.fillText("🔨 HAVEN FORGE", 115, 195);

      const hFlick = 0.85 + Math.sin(time * 0.18) * 0.2;
      const hGlow = ctx.createRadialGradient(110, 240, 0, 110, 240, 44);
      hGlow.addColorStop(0, `rgba(239, 68, 68, ${0.68 * hFlick})`);
      hGlow.addColorStop(0.6, `rgba(245, 158, 11, ${0.35 * hFlick})`);
      hGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = hGlow;
      ctx.beginPath();
      ctx.arc(110, 240, 44, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1e222a";
      ctx.fillRect(180, 245, 18, 12);
      ctx.fillRect(177, 241, 24, 6);

      ctx.fillStyle = "#334155";
      ctx.fillRect(200, 248, 14, 12);
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(201, 249, 12, 4);
      ctx.restore();

      // Mage Sanctum (Elian)
      ctx.save();
      const sanctumX = 635;
      const sanctumY = 240;

      ctx.fillStyle = "#a855f7";
      ctx.font = "bold 9px Cinzel, serif";
      ctx.fillText("🔮 ARCANE SANCTUM", 575, 195);

      ctx.save();
      ctx.translate(sanctumX, sanctumY);
      ctx.rotate(npcs.elian.runeAngle);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = "rgba(192, 132, 252, 0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let bx = 520; bx < width; bx += 10) {
        const by = height - 12 + Math.sin(bx * 0.05 + time * 0.08) * 6;
        if (bx === 520) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.stroke();
      ctx.restore();
    }

    function renderHotspots() {
      for (const h of HOTSPOTS) {
        const isNear = nearHotspot && nearHotspot.id === h.id;
        if (isNear) {
          ctx.save();
          ctx.strokeStyle = "rgba(201, 168, 76, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function renderAtmosphericLighting() {
      if (timeOfDay === 'day') return;

      ctx.save();
      const darkness = timeOfDay === 'night' ? 0.75 : 0.42;
      ctx.fillStyle = timeOfDay === 'night' ? `rgba(6, 8, 16, ${darkness})` : `rgba(28, 16, 10, ${darkness})`;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'destination-out';

      // Tavern lantern
      const lFlicker = 0.85 + Math.sin(time * 0.12) * 0.15;
      const lLight = ctx.createRadialGradient(200, 70, 0, 200, 70, 100 * lFlicker);
      lLight.addColorStop(0, 'rgba(0,0,0,0.85)');
      lLight.addColorStop(0.6, 'rgba(0,0,0,0.4)');
      lLight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lLight;
      ctx.beginPath();
      ctx.arc(200, 70, 100 * lFlicker, 0, Math.PI * 2);
      ctx.fill();

      // Gate torches
      for (const tx of [575, 705]) {
        const tFlick = 0.85 + Math.sin(time * 0.18 + tx) * 0.15;
        const tLight = ctx.createRadialGradient(tx, 72, 0, tx, 72, 80 * tFlick);
        tLight.addColorStop(0, 'rgba(0,0,0,0.85)');
        tLight.addColorStop(0.6, 'rgba(0,0,0,0.35)');
        tLight.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tLight;
        ctx.beginPath();
        ctx.arc(tx, 72, 80 * tFlick, 0, Math.PI * 2);
        ctx.fill();
      }

      // Forge
      const hFlick = 0.85 + Math.sin(time * 0.15) * 0.15;
      const hLight = ctx.createRadialGradient(110, 240, 0, 110, 240, 95 * hFlick);
      hLight.addColorStop(0, 'rgba(0,0,0,0.92)');
      hLight.addColorStop(0.6, 'rgba(0,0,0,0.45)');
      hLight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hLight;
      ctx.beginPath();
      ctx.arc(110, 240, 95 * hFlick, 0, Math.PI * 2);
      ctx.fill();

      // Arcane Sanctum
      const eLight = ctx.createRadialGradient(635, 240, 0, 635, 240, 110);
      eLight.addColorStop(0, 'rgba(0,0,0,0.88)');
      eLight.addColorStop(0.6, 'rgba(0,0,0,0.4)');
      eLight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eLight;
      ctx.beginPath();
      ctx.arc(635, 240, 110, 0, Math.PI * 2);
      ctx.fill();

      // Player presence
      const pLight = ctx.createRadialGradient(player.x, player.y - 10, 0, player.x, player.y - 10, 65);
      pLight.addColorStop(0, 'rgba(0,0,0,0.65)');
      pLight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pLight;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 10, 65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Fireflies
      if (timeOfDay === 'night' || timeOfDay === 'dusk') {
        ctx.save();
        for (const ff of fireflies) {
          const glow = Math.sin(ff.phase) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(250, 204, 21, ${glow * 0.85})`;
          ctx.beginPath();
          ctx.arc(ff.x, ff.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function renderMiniMap() {
      ctx.save();
      const mapR = 36;
      const mx = width - 48;
      const my = 48;

      ctx.fillStyle = "rgba(18, 14, 10, 0.88)";
      ctx.strokeStyle = "rgba(212, 175, 55, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, mapR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(212, 175, 55, 0.5)";
      ctx.font = "bold 8px Cinzel, serif";
      ctx.textAlign = "center";
      ctx.fillText("N", mx, my - mapR + 9);

      const scaleX = (mapR * 1.6) / width;
      const scaleY = (mapR * 1.6) / height;

      for (const npc of Object.values(npcs)) {
        const nx = mx - mapR * 0.8 + npc.x * scaleX;
        const ny = my - mapR * 0.8 + npc.y * scaleY;
        ctx.fillStyle = npc.color;
        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const px = mx - mapR * 0.8 + player.x * scaleX;
      const py = my - mapR * 0.8 + player.y * scaleY;
      const pPulse = 3.5 + Math.sin(time * 0.15) * 1.5;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(px, py, pPulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawProximityRing(x, y, isNear) {
      if (!isNear) return;
      ctx.save();
      const pulse = 1 + Math.sin(time * 0.1) * 0.15;
      const r = 28 * pulse;
      ctx.strokeStyle = "rgba(201, 168, 76, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 8, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(201, 168, 76, 0.18)";
      ctx.fill();
      ctx.restore();
    }

    function drawDetailedHumanSprite(char) {
      const x = char.x;
      const y = char.y;
      const isPlayer = char.isPlayer || false;
      const isMoving = char.isMoving || false;
      const cycle = char.walkCycle || char.frame || 0;
      const breath = char.breath || 0;
      const dir = char.dir || 'down';

      ctx.save();

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      const legSwing = isMoving ? Math.sin(cycle) * 5.5 : 0;
      const bootColor = isPlayer ? "#3e2723" : (char.id === "rowan" ? "#475569" : "#2d1f18");

      ctx.fillStyle = isPlayer ? "#4a3525" : (char.id === "rowan" ? "#334155" : "#3e2723");
      ctx.fillRect(x - 6, y + 2 - legSwing, 4, 8 + legSwing);
      ctx.fillStyle = bootColor;
      ctx.fillRect(x - 7, y + 8, 5, 4);

      ctx.fillStyle = isPlayer ? "#4a3525" : (char.id === "rowan" ? "#334155" : "#3e2723");
      ctx.fillRect(x + 2, y + 2 + legSwing, 4, 8 - legSwing);
      ctx.fillStyle = bootColor;
      ctx.fillRect(x + 2, y + 8, 5, 4);

      // Cloak
      if (isPlayer) {
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath();
        const wave = Math.sin(time * 0.1) * 3;
        ctx.moveTo(x - 8, y - 8);
        ctx.lineTo(x + 8, y - 8);
        ctx.lineTo(x + 10 + wave, y + 6);
        ctx.lineTo(x - 10 - wave, y + 6);
        ctx.closePath();
        ctx.fill();
      } else if (char.id === "elian") {
        ctx.fillStyle = "#4c1d95";
        ctx.beginPath();
        const rWave = Math.sin(time * 0.08) * 2.5;
        ctx.moveTo(x - 8, y - 6);
        ctx.lineTo(x + 8, y - 6);
        ctx.lineTo(x + 9 + rWave, y + 8);
        ctx.lineTo(x - 9 - rWave, y + 8);
        ctx.closePath();
        ctx.fill();
      }

      // Torso
      const torsoY = y - 9 + breath;
      if (isPlayer) {
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(x - 7, torsoY, 14, 12);
        ctx.fillStyle = "#b45309";
        ctx.fillRect(x - 7, torsoY + 8, 14, 3);
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(x - 2, torsoY + 8, 4, 3);
      } else if (char.id === "mira") {
        ctx.fillStyle = "#991b1b";
        ctx.fillRect(x - 6, torsoY + 1, 12, 11);
        ctx.fillStyle = "#fef3c7";
        ctx.fillRect(x - 4, torsoY + 4, 8, 8);
        ctx.fillStyle = "#78350f";
        ctx.fillRect(x - 6, torsoY + 4, 12, 2);
      } else if (char.id === "rowan") {
        const armGrad = ctx.createLinearGradient(x - 7, torsoY, x + 7, torsoY);
        armGrad.addColorStop(0, "#475569");
        armGrad.addColorStop(0.5, "#cbd5e1");
        armGrad.addColorStop(1, "#475569");
        ctx.fillStyle = armGrad;
        ctx.fillRect(x - 8, torsoY, 16, 12);

        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(x - 3, torsoY, 6, 12);
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(x - 1, torsoY + 3, 2, 3);
      } else if (char.id === "aldric") {
        ctx.fillStyle = "#d97706";
        ctx.fillRect(x - 7, torsoY + 1, 14, 11);
        ctx.fillStyle = "#451a03";
        ctx.fillRect(x - 6, torsoY + 1, 2, 9);
        ctx.fillRect(x + 4, torsoY + 1, 2, 9);
      } else if (char.id === "elian") {
        ctx.fillStyle = "#6b21a8";
        ctx.fillRect(x - 7, torsoY, 14, 13);
        ctx.fillStyle = "#e9d5ff";
        ctx.fillRect(x - 1, torsoY, 2, 13);
      }

      // Head
      const headY = y - 14 + breath * 0.5;
      ctx.fillStyle = "#fcd34d";
      ctx.beginPath();
      ctx.arc(x, headY, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      let eyeOffsetX = 0;
      if (dir === 'left') eyeOffsetX = -2;
      else if (dir === 'right') eyeOffsetX = 2;

      const isBlinking = isPlayer && player.blinkTimer < 8;
      if (!isBlinking && dir !== 'up') {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x - 2.5 + eyeOffsetX, headY - 1, 1.5, 2);
        ctx.fillRect(x + 1 + eyeOffsetX, headY - 1, 1.5, 2);
      }

      // Hair
      if (isPlayer) {
        ctx.fillStyle = "#451a03";
        ctx.fillRect(x - 6.5, headY - 6.5, 13, 5);
        ctx.fillStyle = "#15803d";
        ctx.fillRect(x - 7, headY - 3, 14, 2);
      } else if (char.id === "mira") {
        ctx.fillStyle = "#b45309";
        ctx.beginPath();
        ctx.arc(x, headY - 2, 7.5, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 4, headY - 1, 3.5, 8);
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(x + 4, headY + 5, 3.5, 2);
      } else if (char.id === "rowan") {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(x - 7.5, headY - 7, 15, 6.5);
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(x - 2, headY - 10, 4, 4);
      } else if (char.id === "aldric") {
        ctx.fillStyle = "#3e2723";
        ctx.fillRect(x - 6.5, headY - 6, 13, 4);
        ctx.fillStyle = "#1c1917";
        ctx.fillRect(x - 4, headY + 2, 8, 5);
      } else if (char.id === "elian") {
        ctx.fillStyle = "#581c87";
        ctx.beginPath();
        ctx.moveTo(x - 8, headY - 1);
        ctx.lineTo(x + 8, headY - 1);
        ctx.lineTo(x, headY - 11);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(x - 3, headY + 2, 6, 6);
      }

      // Hand items
      if (char.id === "mira") {
        ctx.fillStyle = "#78350f";
        ctx.fillRect(x + 7, y - 6, 5, 7);
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(x + 7, y - 8, 5, 2);
      } else if (char.id === "rowan") {
        ctx.fillStyle = "#1e40af";
        ctx.beginPath();
        ctx.moveTo(x - 13, y - 7);
        ctx.lineTo(x - 5, y - 7);
        ctx.lineTo(x - 9, y + 5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 8, y - 2);
        ctx.lineTo(x + 14, y - 10);
        ctx.stroke();
      } else if (char.id === "aldric") {
        ctx.save();
        ctx.translate(x + 8, y - 4);
        const hAngle = char.hammerDown ? 0.8 : -0.6;
        ctx.rotate(hAngle);
        ctx.fillStyle = "#78350f";
        ctx.fillRect(0, -2, 10, 3);
        ctx.fillStyle = "#475569";
        ctx.fillRect(8, -6, 5, 11);
        ctx.restore();
      } else if (char.id === "elian") {
        ctx.strokeStyle = "#78350f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 9, y + 8);
        ctx.lineTo(x + 9, y - 20);
        ctx.stroke();

        ctx.fillStyle = "#d8b4fe";
        ctx.beginPath();
        ctx.arc(x + 9, y - 21, 4, 0, Math.PI * 2);
        ctx.fill();

        const bookBob = char.bookBob || 0;
        ctx.fillStyle = "#4c1d95";
        ctx.fillRect(x - 16, y - 14 + bookBob, 8, 10);
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(x - 15, y - 13 + bookBob, 6, 8);
      }

      // Name & mood tag
      ctx.textAlign = "center";
      if (isPlayer) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.fillText("⚔️ Ramu (You)", x, y - 27);
      } else {
        ctx.fillStyle = char.color || "#d4af37";
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.fillText(`${char.moodIcon || ''} ${char.name}`, x, y - 27);

        ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
        ctx.font = "italic 7.5px Inter, sans-serif";
        ctx.fillText(char.mood || char.role, x, y - 19);
      }

      ctx.restore();
    }

    function renderSpeechBubble(b) {
      ctx.save();
      ctx.font = "11px Inter, sans-serif";
      const textW = Math.min(240, ctx.measureText(b.text).width + 20);
      const boxW = Math.max(80, textW);
      const boxH = 26;
      const bx = b.x - boxW / 2;
      const by = b.y - boxH;

      const alpha = Math.min(1, b.life / 30);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = "rgba(23, 20, 15, 0.95)";
      ctx.strokeStyle = "rgba(201, 168, 76, 0.85)";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(23, 20, 15, 0.95)";
      ctx.beginPath();
      ctx.moveTo(b.x - 5, by + boxH);
      ctx.lineTo(b.x + 5, by + boxH);
      ctx.lineTo(b.x, by + boxH + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f5ead8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.text, b.x, by + boxH / 2);

      ctx.restore();
    }

    function gameLoop() {
      time++;
      update();
      render();
      animId = requestAnimationFrame(gameLoop);
    }

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [timeOfDay, audioEnabled, onSelectNpc, onInspectHotspot, gameWorldRef, onOpenChatInput]);

  function cycleTimeOfDay() {
    setTimeOfDay((prev) => {
      if (prev === 'dusk') return 'night';
      if (prev === 'night') return 'day';
      return 'dusk';
    });
  }

  function toggleAudio() {
    setAudioEnabled((prev) => !prev);
  }

  function toggleExpand() {
    setIsExpanded((prev) => !prev);
  }

  return (
    <div
      ref={containerRef}
      className={`game-world-container ${isExpanded ? 'expanded' : ''}`}
      id="game-world-container"
    >
      <canvas ref={canvasRef} className="world-canvas" id="world-canvas" />

      <div className="world-overlay-bar">
        <div className="world-pill">
          <span>🏰 Haven Village (Live World)</span>
          <span style={{ opacity: 0.35 }}>|</span>
          <span style={{ color: 'var(--gold-light)' }}>
            WASD / Arrows to Walk • Shift to Sprint • [E] Talk • [Space] Inspect
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="world-btn" onClick={cycleTimeOfDay} id="tod-btn">
            {timeOfDay === 'day' ? '☀️ Day Light' : timeOfDay === 'night' ? '🌙 Night Light' : '🌅 Dusk Light'}
          </button>
          <button className="world-btn" onClick={toggleAudio} id="world-sound-btn">
            {audioEnabled ? '🔊 World Audio: ON' : '🔇 World Audio: MUTED'}
          </button>
          <button className="world-btn" onClick={toggleExpand} id="toggle-world-btn">
            ↕ Toggle View Size
          </button>
        </div>
      </div>

      <div ref={promptRef} className="interact-prompt" id="interact-prompt">
        Press [E] to Speak
      </div>
    </div>
  );
}
