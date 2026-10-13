import React, { useEffect, useRef, useState, useCallback } from 'react';

const PHRASES = [
  "Long ago, when the forest was young,",
  "a barrier of ancient magic rose to protect the village of Haven.",
  "For generations… it kept us safe.",
  "But now… the barrier is weakening.",
  "Villagers have vanished.",
  "Animals no longer return from the treeline.",
  "Strange symbols have begun to appear among the old trees.",
  "No one knows why.",
  "You arrive at Haven as a stranger —",
  "but perhaps… not by chance.",
  "The people here hold secrets.",
  "Some will trust you. Others will not.",
  "What you say, and who you tell it to,",
  "will shape what happens here.",
  "The truth about the barrier is still out there,",
  "waiting to be found.",
  "Are you ready… to enter Haven?"
];

export default function WelcomePage({ onEnter }) {
  const canvasRef        = useRef(null);
  const captionRef       = useRef(null);
  const [muted, setMuted]       = useState(false);
  const [phase, setPhase]       = useState('intro');   // 'intro' | 'cta' | 'leaving'
  const [dotStates, setDotStates] = useState(Array(PHRASES.length).fill('idle'));
  const [currentPhraseIdx, setCurrentPhraseIdx] = useState(0);
  const currentPhrase    = useRef(0);
  const fallbackTimer    = useRef(null);
  const syncedRef        = useRef(false);
  const mutedRef         = useRef(false);
  const cancelledRef     = useRef(false);  // set true on skip — stops all callbacks
  const fallbackPhraseRef = useRef(null);
  const speakPhraseRef    = useRef(null);

  // Keep mutedRef in sync with state
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  /* ─────────────────────────────────────────
     Canvas background (stars + fog + sparks)
  ───────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, animId, t = 0;

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random() * 0.75,
      size: 0.5 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.008 + Math.random() * 0.025
    }));

    const fogPuffs = Array.from({ length: 18 }, () => ({
      x: Math.random() * 1.4 - 0.2, y: 0.35 + Math.random() * 0.65,
      r: 80 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.00015,
      vy: -Math.random() * 0.00008,
      a: 0.015 + Math.random() * 0.04,
      hue: 250 + Math.random() * 60
    }));

    const sparks = [];
    function spawnSpark() {
      sparks.push({
        x: Math.random(), y: 0.55 + Math.random() * 0.45,
        vx: (Math.random() - 0.5) * 0.001,
        vy: -0.0005 - Math.random() * 0.001,
        a: 0, maxA: 0.5 + Math.random() * 0.4,
        life: 0, maxLife: 120 + Math.random() * 180,
        size: 1 + Math.random() * 2,
        gold: Math.random() > 0.4
      });
    }
    for (let i = 0; i < 35; i++) spawnSpark();

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function loop() {
      t++;
      ctx.clearRect(0, 0, W, H);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,   '#04020c');
      sky.addColorStop(0.4, '#0d052a');
      sky.addColorStop(0.7, '#180840');
      sky.addColorStop(1,   '#07030f');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Stars
      for (const s of stars) {
        const br = (Math.sin(t * s.speed + s.phase) + 1) / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.15 + br * 0.7})`;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2); ctx.fill();
      }

      // Horizon barrier glow
      const bg = ctx.createLinearGradient(0, H * 0.72, 0, H);
      bg.addColorStop(0, 'rgba(100,20,200,0)');
      bg.addColorStop(0.4, `rgba(120,30,220,${0.06 + Math.sin(t * 0.02) * 0.03})`);
      bg.addColorStop(1, 'rgba(80,10,160,0.1)');
      ctx.fillStyle = bg; ctx.fillRect(0, H * 0.72, W, H * 0.28);

      // Fog
      for (const fp of fogPuffs) {
        const x = fp.x * W, y = fp.y * H;
        const g = ctx.createRadialGradient(x, y, 0, x, y, fp.r);
        g.addColorStop(0,   `hsla(${fp.hue},60%,20%,${fp.a})`);
        g.addColorStop(0.5, `hsla(${fp.hue},50%,12%,${fp.a * 0.4})`);
        g.addColorStop(1,   'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, fp.r * 1.6, fp.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        fp.x += fp.vx; fp.y += fp.vy;
        if (fp.x > 1.3 || fp.x < -0.3) fp.vx *= -1;
        if (fp.y < 0.3) fp.vy = Math.abs(fp.vy);
        if (fp.y > 1.1) fp.vy = -Math.abs(fp.vy);
      }

      // Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++; s.x += s.vx; s.y += s.vy;
        const half = s.maxLife / 2;
        s.a = s.life < half ? (s.life / half) * s.maxA : ((s.maxLife - s.life) / half) * s.maxA;
        const col = s.gold ? `rgba(201,168,76,${s.a})` : `rgba(180,120,255,${s.a})`;
        ctx.fillStyle = col; ctx.shadowBlur = 6; ctx.shadowColor = col;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (s.life >= s.maxLife) { sparks.splice(i, 1); spawnSpark(); }
      }

      animId = requestAnimationFrame(loop);
    }

    loop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  /* ─────────────────────────────────────────
     Caption reveal (word-by-word)
  ───────────────────────────────────────── */
  const revealPhrase = useCallback((text, onComplete) => {
    const box = captionRef.current;
    if (!box) return;
    box.innerHTML = '';
    const words = text.split(' ');
    words.forEach(w => {
      const sp = document.createElement('span');
      sp.className = 'wc-word';
      sp.textContent = w + ' ';
      box.appendChild(sp);
    });
    const perWord = Math.min(180, 1200 / words.length);
    const els = box.querySelectorAll('.wc-word');
    els.forEach((el, i) => {
      setTimeout(() => {
        if (cancelledRef.current) return;   // ← bail if skipped
        el.classList.add('wc-lit');
        if (i === els.length - 1 && onComplete) setTimeout(() => {
          if (!cancelledRef.current) onComplete(); // ← bail if skipped
        }, 200);
      }, i * perWord);
    });
  }, []);

  const showCta = useCallback(() => {
    cancelledRef.current = true;              // FIRST: stop all in-flight callbacks
    clearTimeout(fallbackTimer.current);
    if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
    setDotStates(prev => prev.map(() => 'done'));
    // Use 50ms so it fires even if speech cancel fires onerror synchronously
    setTimeout(() => setPhase('cta'), 50);
  }, []);

  /* Fallback timer-based progression */
  const fallbackPhrase = useCallback((idx) => {
    if (cancelledRef.current) return;         // ← bail if skipped
    if (idx >= PHRASES.length) { showCta(); return; }
    currentPhrase.current = idx;
    setCurrentPhraseIdx(idx);
    setDotStates(prev => {
      const n = [...prev];
      if (idx > 0) n[idx - 1] = 'done';
      n[idx] = 'active';
      return n;
    });
    revealPhrase(PHRASES[idx], () => {
      if (cancelledRef.current) return;       // ← bail if skipped mid-reveal
      fallbackTimer.current = setTimeout(() => {
        fallbackPhraseRef.current?.(idx + 1);
      }, 400);
    });
  }, [revealPhrase, showCta]);

  /* Speech synthesis chain */
  const speakPhrase = useCallback((idx) => {
    if (idx >= PHRASES.length) { showCta(); return; }
    if (mutedRef.current) { fallbackPhraseRef.current?.(idx); return; }

    currentPhrase.current = idx;
    setCurrentPhraseIdx(idx);
    setDotStates(prev => {
      const n = [...prev];
      if (idx > 0) n[idx - 1] = 'done';
      n[idx] = 'active';
      return n;
    });

    const utt = new SpeechSynthesisUtterance(PHRASES[idx]);
    utt.rate = 0.88; utt.pitch = 0.82; utt.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      const pick = voices.find(v => /daniel|george|alex|david|british|deep/i.test(v.name))
                || voices.find(v => v.lang.startsWith('en'))
                || voices[0];
      if (pick) utt.voice = pick;
    }
    utt.onstart = () => { if (cancelledRef.current) return; syncedRef.current = true; revealPhrase(PHRASES[idx]); };
    utt.onend   = () => { if (cancelledRef.current) return; setTimeout(() => speakPhraseRef.current?.(idx + 1), 280); };
    utt.onerror = () => { if (cancelledRef.current) return; fallbackPhraseRef.current?.(idx); }; // ← ignore cancel-triggered error
    window.speechSynthesis.speak(utt);
  }, [revealPhrase, showCta]);

  useEffect(() => {
    fallbackPhraseRef.current = fallbackPhrase;
    speakPhraseRef.current = speakPhrase;
  });

  /* Start narration */
  const startNarration = useCallback(() => {
    currentPhrase.current = 0;
    setCurrentPhraseIdx(0);
    syncedRef.current = false;
    if (!mutedRef.current && typeof window.speechSynthesis !== 'undefined') {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          speakPhraseRef.current?.(0);
        };
        setTimeout(() => {
          if (currentPhrase.current === 0 && !syncedRef.current) speakPhraseRef.current?.(0);
        }, 1200);
      } else {
        speakPhraseRef.current?.(0);
      }
    } else {
      fallbackPhraseRef.current?.(0);
    }
  }, []);

  // Start on mount
  useEffect(() => {
    const t = setTimeout(startNarration, 1200);
    return () => {
      clearTimeout(t);
      clearTimeout(fallbackTimer.current);
      if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
    };
  }, [startNarration]);

  /* Skip */
  const handleSkip = useCallback(() => {
    showCta(); // showCta sets cancelledRef=true first, then cancels speech
  }, [showCta]);

  /* Mute toggle */
  const handleMute = useCallback(() => {
    const nowMuted = !mutedRef.current;
    setMuted(nowMuted);
    mutedRef.current = nowMuted;
    if (nowMuted && typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
      clearTimeout(fallbackTimer.current);
      fallbackPhrase(currentPhrase.current);
    }
  }, [fallbackPhrase]);

  /* Enter Haven */
  const handleEnter = useCallback(() => {
    setPhase('leaving');
    setTimeout(onEnter, 1000);
  }, [onEnter]);

  /* ─── Dot helpers ─── */
  function dotClass(state) {
    if (state === 'active') return 'wc-dot wc-dot-active';
    if (state === 'done')   return 'wc-dot wc-dot-done';
    return 'wc-dot';
  }

  const isFaded  = phase === 'cta' || phase === 'leaving';
  const isLeaving = phase === 'leaving';
  const showCTA   = phase === 'cta' || phase === 'leaving';

  return (
    <>
      <style>{`
        .wc-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start;
          overflow: hidden;
          opacity: 1;
          transition: opacity 0.6s ease;
          font-family: 'Crimson Text', Georgia, serif;
          pointer-events: all;
        }
        /* Fade out intro when CTA is showing */
        .wc-root.faded  { opacity: 0; pointer-events: none; }
        .wc-root.leaving { opacity: 0; pointer-events: none; }

        .wc-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }

        .wc-overlay {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background:
            radial-gradient(ellipse 80% 55% at 50% 0%, rgba(45,13,80,0.7) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 20% 100%, rgba(10,4,24,0.8) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(10,4,24,0.8) 0%, transparent 60%);
        }

        /* Controls */
        .wc-controls {
          position: absolute; top: 20px; right: 24px;
          display: flex; gap: 10px; z-index: 100; align-items: center;
        }
        .wc-btn {
          background: rgba(10,6,20,0.78);
          border: 1px solid rgba(201,168,76,0.25);
          backdrop-filter: blur(6px);
          color: #8b7d6b;
          font-family: 'Cinzel', serif;
          font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em;
          padding: 7px 14px; border-radius: 20px; cursor: pointer;
          transition: all 0.22s ease; white-space: nowrap;
        }
        .wc-btn:hover {
          border-color: #7a6230; color: #e8c96d;
          box-shadow: 0 0 14px rgba(201,168,76,0.2);
        }
        .wc-mute { width: 36px; height: 36px; padding: 0; border-radius: 50%; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }

        /* Content */
        .wc-content {
          position: relative; z-index: 10;
          display: flex; flex-direction: column; align-items: center;
          width: 100%; max-width: 720px;
          padding: 0 24px; margin-top: 5vh;
        }

        /* Narrator */
        .wc-fig-wrap {
          position: relative; width: 160px; height: 220px;
          display: flex; align-items: flex-end; justify-content: center;
          margin-bottom: 10px;
        }
        .wc-aura {
          position: absolute; inset: -30px; border-radius: 50%;
          background: radial-gradient(ellipse at 50% 60%, rgba(154,61,255,0.22) 0%, rgba(100,30,200,0.10) 40%, transparent 70%);
          animation: wcAuraPulse 3.5s ease-in-out infinite alternate;
        }
        @keyframes wcAuraPulse {
          from { opacity: 0.5; transform: scale(0.92); }
          to   { opacity: 1.0; transform: scale(1.08); }
        }
        .wc-figure {
          animation: wcFloat 4s ease-in-out infinite alternate; position: relative; z-index: 2;
        }
        @keyframes wcFloat {
          from { transform: translateY(0); }
          to   { transform: translateY(-12px); }
        }
        .wc-svg {
          filter: drop-shadow(0 0 18px rgba(154,61,255,0.65)) drop-shadow(0 0 40px rgba(100,20,200,0.35));
          animation: wcSvgGlow 2.8s ease-in-out infinite alternate;
        }
        @keyframes wcSvgGlow {
          from { filter: drop-shadow(0 0 12px rgba(154,61,255,0.5)) drop-shadow(0 0 30px rgba(100,20,200,0.25)); }
          to   { filter: drop-shadow(0 0 28px rgba(180,100,255,0.85)) drop-shadow(0 0 55px rgba(120,40,220,0.45)); }
        }
        .wc-eye { animation: wcEye 2.2s ease-in-out infinite alternate; }
        @keyframes wcEye { from { opacity: 0.6; } to { opacity: 1; } }
        .wc-orb { animation: wcOrb 1.8s ease-in-out infinite alternate; }
        @keyframes wcOrb { from { opacity: 0.7; } to { opacity: 1; } }

        /* Rune orbit */
        .wc-rune {
          position: absolute; top: 50%; left: 50%;
          font-family: serif; font-size: 1rem; color: rgba(200,140,255,0.7);
          transform-origin: 0 0; pointer-events: none;
          animation: wcRuneOrbit 6s linear infinite;
        }
        @keyframes wcRuneOrbit {
          from { transform: rotate(0deg) translateX(72px) rotate(0deg); opacity: 0.2; }
          25%  { opacity: 0.8; }
          50%  { opacity: 0.3; }
          75%  { opacity: 0.9; }
          to   { transform: rotate(360deg) translateX(72px) rotate(-360deg); opacity: 0.2; }
        }

        /* Caption */
        .wc-cap-wrap {
          width: 100%; display: flex; flex-direction: column;
          align-items: center; gap: 6px; padding: 0 10px;
        }
        .wc-title {
          font-family: 'Cinzel', serif;
          font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 900;
          color: #e8c96d; letter-spacing: 0.12em; text-align: center; line-height: 1.2;
          text-shadow: 0 0 30px rgba(201,168,76,0.6), 0 0 60px rgba(201,168,76,0.25);
          animation: wcTitleIn 1.5s ease-out both;
        }
        @keyframes wcTitleIn {
          from { opacity: 0; transform: translateY(-16px); letter-spacing: 0.4em; }
          to   { opacity: 1; transform: translateY(0); letter-spacing: 0.12em; }
        }
        .wc-sub {
          font-size: clamp(0.9rem, 2.2vw, 1.1rem); font-style: italic;
          color: #8b7d6b; letter-spacing: 0.18em; text-align: center;
          animation: wcTitleIn 2s ease-out 0.5s both;
        }
        .wc-box {
          margin-top: 18px; width: 100%; min-height: 90px;
          padding: 18px 24px;
          background: rgba(4,3,10,0.65);
          border: 1px solid rgba(154,61,255,0.2); border-radius: 12px;
          backdrop-filter: blur(8px);
          box-shadow: 0 0 30px rgba(154,61,255,0.08), inset 0 0 20px rgba(0,0,0,0.3);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          opacity: 0; transition: opacity 0.5s ease;
        }
        .wc-box.vis { opacity: 1; }
        .wc-text {
          font-size: clamp(1.1rem, 2.8vw, 1.45rem); color: #d4c4a8;
          text-align: center; line-height: 1.65; min-height: 2.6em;
        }
        .wc-word { display: inline; opacity: 0; transition: opacity 0.12s ease; }
        .wc-lit  { opacity: 1 !important; }
        .wc-dots { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
        .wc-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(154,61,255,0.2); transition: background 0.3s ease, transform 0.3s ease;
        }
        .wc-dot-done { background: #9a3dff; transform: scale(1.3); box-shadow: 0 0 6px rgba(154,61,255,0.6); }
        .wc-dot-active {
          background: #c9a84c; transform: scale(1.5); box-shadow: 0 0 8px rgba(201,168,76,0.7);
          animation: wcDotPulse 0.8s ease-in-out infinite alternate;
        }
        @keyframes wcDotPulse { from { transform: scale(1.3); } to { transform: scale(1.7); } }

        /* CTA */
        .wc-cta {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
          opacity: 0; pointer-events: none; transition: opacity 1.4s ease;
          background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(45,13,80,0.5) 0%, rgba(4,3,10,0.9) 60%, rgba(4,3,10,1) 100%);
        }
        .wc-cta.vis { opacity: 1; pointer-events: all; }
        .wc-cta-crest {
          font-size: 3.2rem;
          filter: drop-shadow(0 0 20px rgba(201,168,76,0.5));
          animation: wcCrestSpin 10s linear infinite;
        }
        @keyframes wcCrestSpin { to { transform: rotate(360deg); } }
        .wc-cta-title {
          font-family: 'Cinzel', serif;
          font-size: clamp(1.8rem, 5vw, 3rem); font-weight: 900;
          color: #e8c96d; letter-spacing: 0.15em; text-align: center;
          animation: wcCtaPulse 2.5s ease-in-out infinite alternate;
        }
        @keyframes wcCtaPulse {
          from { text-shadow: 0 0 20px rgba(201,168,76,0.4); }
          to   { text-shadow: 0 0 50px rgba(201,168,76,0.9), 0 0 80px rgba(201,168,76,0.3); }
        }
        .wc-cta-sub {
          font-size: clamp(1rem, 2.5vw, 1.3rem); font-style: italic;
          color: #8b7d6b; letter-spacing: 0.12em; text-align: center;
        }
        .wc-enter-row { position: relative; display: flex; align-items: center; justify-content: center; margin-top: 10px; }
        .wc-enter-rune {
          position: absolute; font-family: serif; font-size: 1.4rem; color: rgba(154,61,255,0.6);
          animation: wcRuneFloat 3s ease-in-out infinite alternate;
        }
        .wc-enter-rune:nth-child(1) { left: -88px; }
        .wc-enter-rune:nth-child(2) { right: -88px; animation-delay: 0.5s; }
        .wc-enter-rune:nth-child(3) { left: -64px; top: -44px; animation-delay: 1s; }
        .wc-enter-rune:nth-child(4) { right: -64px; top: -44px; animation-delay: 1.5s; }
        @keyframes wcRuneFloat {
          from { opacity: 0.3; transform: translateY(0); }
          to   { opacity: 0.8; transform: translateY(-8px); }
        }
        .wc-enter-btn {
          position: relative; padding: 16px 52px;
          background: transparent; border: 2px solid #c9a84c; border-radius: 50px;
          font-family: 'Cinzel', serif; font-size: clamp(0.9rem, 2.2vw, 1.1rem);
          font-weight: 700; letter-spacing: 0.2em; color: #e8c96d;
          cursor: pointer; overflow: hidden; transition: all 0.3s ease;
          animation: wcEnterPulse 2s ease-in-out infinite;
        }
        @keyframes wcEnterPulse {
          0%,100% { box-shadow: 0 0 20px rgba(201,168,76,0.3), inset 0 0 20px rgba(201,168,76,0.05); }
          50%      { box-shadow: 0 0 44px rgba(201,168,76,0.65), inset 0 0 28px rgba(201,168,76,0.12); }
        }
        .wc-enter-btn:hover {
          transform: scale(1.07) translateY(-2px);
          border-color: #e8c96d; color: #fff;
          box-shadow: 0 0 60px rgba(201,168,76,0.7), 0 8px 32px rgba(0,0,0,0.5);
        }
        .wc-enter-btn::after {
          content: ''; position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: wcShimmer 2.5s ease-in-out infinite;
        }
        @keyframes wcShimmer { from { left: -100%; } to { left: 200%; } }

        @media (max-width: 600px) {
          .wc-content { margin-top: 2vh; }
          .wc-fig-wrap { width: 110px; height: 160px; }
        }
      `}</style>

      {/* ── Root ── */}
      <div className={`wc-root${isFaded ? ' faded' : ''}${isLeaving ? ' leaving' : ''}`}>
        <canvas ref={canvasRef} className="wc-canvas" />
        <div className="wc-overlay" />

        {/* Controls */}
        <div className="wc-controls">
          <button className="wc-btn wc-mute" onClick={handleMute} aria-label="Toggle mute">
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="wc-btn" onClick={handleSkip} aria-label="Skip intro">
            Skip Intro ▶
          </button>
        </div>

        {/* Main content */}
        <div className="wc-content">

          {/* Narrator figure */}
          <div className="wc-fig-wrap">
            <div className="wc-aura" />
            {['ᚠ','ᚢ','ᚦ','ᚱ'].map((r, i) => (
              <span key={r} className="wc-rune" style={{ animationDelay: `${-i * 1.5}s` }}>{r}</span>
            ))}
            <div className="wc-figure">
              <svg className="wc-svg" width="130" height="210" viewBox="0 0 130 210" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="wc-orb" cx="40%" cy="35%">
                    <stop offset="0%"   stopColor="#e8d4ff" />
                    <stop offset="40%"  stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </radialGradient>
                  <linearGradient id="wc-staff" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor="#6b21a8" />
                    <stop offset="50%"  stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#4c1d95" />
                  </linearGradient>
                  <linearGradient id="wc-robe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#1a0a2e" />
                    <stop offset="50%"  stopColor="#120820" />
                    <stop offset="100%" stopColor="#0a0514" />
                  </linearGradient>
                  <linearGradient id="wc-hood" x1="0.5" y1="0" x2="0.5" y2="1">
                    <stop offset="0%"   stopColor="#2d1050" />
                    <stop offset="60%"  stopColor="#1a0830" />
                    <stop offset="100%" stopColor="#0f0520" />
                  </linearGradient>
                  <radialGradient id="wc-eye" cx="40%" cy="35%">
                    <stop offset="0%"   stopColor="#f0d0ff" />
                    <stop offset="50%"  stopColor="#b060ff" />
                    <stop offset="100%" stopColor="#6020c0" />
                  </radialGradient>
                </defs>
                {/* Staff orb glow */}
                <circle cx="24" cy="28" r="10" fill="rgba(200,140,255,0.15)" />
                <circle className="wc-orb" cx="24" cy="28" r="7" fill="url(#wc-orb)" />
                {/* Staff pole */}
                <rect x="22" y="34" width="4" height="130" rx="2" fill="url(#wc-staff)" />
                {/* Robe body */}
                <path d="M65 85 C48 95,30 115,20 155 C18 162,16 172,20 180 L110 180 C114 172,112 162,110 155 C100 115,82 95,65 85Z" fill="url(#wc-robe)" />
                <path d="M65 95 C52 108,38 128,30 160 L100 160 C92 128,78 108,65 95Z" fill="rgba(10,4,24,0.4)" />
                <line x1="65" y1="90" x2="22" y2="178" stroke="rgba(154,61,255,0.3)" strokeWidth="1.2" />
                <line x1="65" y1="90" x2="108" y2="178" stroke="rgba(154,61,255,0.3)" strokeWidth="1.2" />
                <ellipse cx="65" cy="180" rx="45" ry="6" fill="rgba(154,61,255,0.2)" />
                {/* Sleeves */}
                <path d="M50 100 C36 105,24 112,22 130 C20 138,24 142,28 140 C34 130,40 122,50 115Z" fill="url(#wc-robe)" />
                <path d="M80 100 C94 105,106 112,108 130 C110 138,106 142,102 140 C96 130,90 122,80 115Z" fill="url(#wc-robe)" />
                <ellipse cx="24" cy="140" rx="6" ry="4" fill="rgba(30,15,50,0.9)" />
                {/* Neck */}
                <rect x="60" y="72" width="10" height="16" rx="4" fill="rgba(20,10,35,0.9)" />
                {/* Hood */}
                <path d="M65 20 C38 22,28 38,28 58 C28 76,36 86,50 90 C56 92,60 90,65 88 C70 90,74 92,80 90 C94 86,102 76,102 58 C102 38,92 22,65 20Z" fill="url(#wc-hood)" />
                <path d="M65 8 C60 14,56 20,56 26 L74 26 C74 20,70 14,65 8Z" fill="url(#wc-hood)" />
                <path d="M65 36 C52 36,44 44,42 56 C40 66,44 74,52 78 L65 80 L78 78 C86 74,90 66,88 56 C86 44,78 36,65 36Z" fill="rgba(4,2,12,0.85)" />
                <ellipse cx="65" cy="62" rx="18" ry="16" fill="rgba(4,2,12,0.9)" />
                {/* Eyes */}
                <circle className="wc-eye" cx="58" cy="58" r="3.5" fill="url(#wc-eye)" />
                <circle className="wc-eye" cx="72" cy="58" r="3.5" fill="url(#wc-eye)" />
                <circle cx="58" cy="58" r="1.5" fill="rgba(255,255,255,0.9)" />
                <circle cx="72" cy="58" r="1.5" fill="rgba(255,255,255,0.9)" />
                {/* Hood rim */}
                <path d="M44 52 C44 40,52 32,65 30 C78 32,86 40,86 52" stroke="rgba(130,60,220,0.5)" strokeWidth="2" fill="none" />
                {/* Belt clasp */}
                <ellipse cx="65" cy="110" rx="8" ry="5" fill="rgba(201,168,76,0.4)" />
                <ellipse cx="65" cy="110" rx="5" ry="3" fill="rgba(201,168,76,0.25)" />
              </svg>
            </div>
          </div>

          {/* Title + captions */}
          <div className="wc-cap-wrap">
            <div className="wc-title">Echoes of Haven</div>
            <div className="wc-sub">A village on the edge of something ancient…</div>

            <div className={`wc-box${phase !== 'intro' || currentPhraseIdx > 0 ? ' vis' : ''}`}
                 style={{ opacity: 1 }}>
              <div className="wc-text" ref={captionRef} />
              <div className="wc-dots">
                {dotStates.map((s, i) => (
                  <div key={i} className={dotClass(s)} />
                ))}
              </div>
            </div>
          </div>

        </div>{/* /content */}
      </div>{/* /root */}

      {/* ── CTA Screen ── */}
      <div className={`wc-cta${showCTA ? ' vis' : ''}`}>
        <div className="wc-cta-crest">⚔️</div>
        <div className="wc-cta-title">HAVEN AWAITS</div>
        <div className="wc-cta-sub">The barrier holds… for now.</div>
        <div className="wc-enter-row">
          <span className="wc-enter-rune">ᚠ</span>
          <span className="wc-enter-rune">ᚱ</span>
          <span className="wc-enter-rune">ᚢ</span>
          <span className="wc-enter-rune">ᚦ</span>
          <button className="wc-enter-btn" onClick={handleEnter} aria-label="Enter Haven">
            ⚔ Enter Haven ⚔
          </button>
        </div>
      </div>
    </>
  );
}
