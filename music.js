// =============================================================
//  THE BATTLE BLOBS — music.js
//  Self-contained chiptune engine (Web Audio API).
//  Same synthesis approach BeepBox uses: rounded triangle voices
//  with a pitch "bloop", a noise drum kit, and a look-ahead scheduler.
//
//  Public API (window.Music):
//    Music.startBattle()  – loop the gameplay battle theme
//    Music.victory()      – stop battle, play the win fanfare
//    Music.defeat()       – stop battle, play the lose jingle
//    Music.toggleMute()   – mute / unmute (returns new muted state)
// =============================================================

window.Music = (() => {
  let ctx = null;
  let master = null;
  let bassFilter = null;
  let noiseBuf = null;
  let muted = false;

  // Look-ahead scheduler state for the looping battle theme.
  let loopEvents = null;     // sorted [{t, play}] for one loop iteration
  let loopDur    = 0;        // seconds per loop
  let loopBase   = 0;        // ctx time at which the current loop started
  let evIndex    = 0;
  let schedTimer = null;
  let playing    = false;
  let wantBattle = false;    // desired state before audio is unlocked

  // ── Audio graph ───────────────────────────────────────────
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 6000;
    master.connect(soften);
    soften.connect(ctx.destination);

    bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 900;
    bassFilter.connect(master);

    // White-noise buffer reused by every drum hit.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ── Voices ────────────────────────────────────────────────
  // `squish` adds a quick pitch glide up into the note — a blobby "bloop".
  function voice(type, midi, startT, dur, gain, dest, squish) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    const f = mtof(midi);
    if (squish) {
      osc.frequency.setValueAtTime(f * 0.7, startT);
      osc.frequency.exponentialRampToValueAtTime(f, startT + 0.05);
    } else {
      osc.frequency.value = f;
    }
    osc.connect(g);
    g.connect(dest || master);

    // Soft, rounded envelope so notes feel bouncy rather than sharp.
    const atk = 0.014;
    const rel = Math.min(0.1, dur * 0.6);
    g.gain.setValueAtTime(0, startT);
    g.gain.linearRampToValueAtTime(gain, startT + atk);
    g.gain.setValueAtTime(gain, Math.max(startT + atk, startT + dur - rel));
    g.gain.linearRampToValueAtTime(0, startT + dur);

    osc.start(startT);
    osc.stop(startT + dur + 0.03);
  }

  function drum(kind, startT) {
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, startT);
      osc.frequency.exponentialRampToValueAtTime(48, startT + 0.12);
      g.gain.setValueAtTime(0.55, startT);
      g.gain.exponentialRampToValueAtTime(0.001, startT + 0.16);
      osc.connect(g); g.connect(master);
      osc.start(startT); osc.stop(startT + 0.18);
      return;
    }
    // snare / hat = filtered noise burst
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    const g  = ctx.createGain();
    let stopT;
    if (kind === 'snare') {
      hp.type = 'highpass'; hp.frequency.value = 1400;
      g.gain.setValueAtTime(0.32, startT);
      g.gain.exponentialRampToValueAtTime(0.001, startT + 0.13);
      stopT = startT + 0.15;
    } else { // hat
      hp.type = 'highpass'; hp.frequency.value = 7000;
      g.gain.setValueAtTime(0.11, startT);
      g.gain.exponentialRampToValueAtTime(0.001, startT + 0.04);
      stopT = startT + 0.05;
    }
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(startT);
    src.stop(stopT);
  }

  // ── Battle theme ──────────────────────────────────────────
  //  Battle-Cats-style song form: a fast bouncy verse (A) loops 4×,
  //  then drops into a slower, more melodic chorus (B), then repeats.
  const TEMPO        = 150;
  const BEAT         = 60 / TEMPO;          // 0.4 s — verse
  const CHORUS_TEMPO = 96;
  const CBEAT        = 60 / CHORUS_TEMPO;   // 0.625 s — slower chorus
  const A_REPEATS    = 4;

  // Verse (4 bars, A-minor march: Am F C G)
  function sectionA() {
    const LEAD = [
      76,72,69,72, 76,72,69,71,   // Am
      69,72,77,72, 69,65,69,72,   // F
      79,76,72,76, 79,76,72,74,   // C
      74,71,67,71, 74,79,74,71,   // G
    ];
    const ROOTS = [45, 41, 48, 43]; // A2 F2 C3 G2, one per bar
    const ev = [];
    const at = (beat) => beat * BEAT;
    const SWING = BEAT * 0.06;   // nudge off-beats late for a playful bounce

    for (let bar = 0; bar < 4; bar++) {
      const r = ROOTS[bar];
      const bassPat = [r, r + 12, r + 7, r + 12, r, r + 12, r + 7, r + 12];
      for (let i = 0; i < 8; i++) {
        const swing = (i % 2) ? SWING : 0;
        const t = at(bar * 4 + i * 0.5) + swing;
        const lead = LEAD[bar * 8 + i];
        // Round triangle tone + pitch "bloop" = squishy blob lead.
        ev.push({ t, play: (s) => voice('triangle', lead, s, BEAT * 0.42, 0.3, null, true) });
        ev.push({ t: at(bar * 4 + i * 0.5),
                  play: (s) => voice('triangle', bassPat[i], s, BEAT * 0.45, 0.34, bassFilter, true) });
        ev.push({ t, play: (s) => drum('hat', s) });
      }
      const b = bar * 4;
      [0, 2, 2.5].forEach((k) => ev.push({ t: at(b + k), play: (s) => drum('kick', s) }));
      [1, 3].forEach((k) => ev.push({ t: at(b + k), play: (s) => drum('snare', s) }));
    }
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, dur: at(16) };   // 16 beats
  }

  // Chorus (4 bars, slower & lyrical: C G Am F)
  function sectionB() {
    const at = (beat) => beat * CBEAT;
    // Sustained, singable descending melody — {note, beat, dur(beats)}
    const MELODY = [
      { n: 76, t: 0,  d: 1 }, { n: 79, t: 1,  d: 1 }, { n: 84, t: 2,  d: 2 }, // C
      { n: 83, t: 4,  d: 1 }, { n: 79, t: 5,  d: 1 }, { n: 74, t: 6,  d: 2 }, // G
      { n: 81, t: 8,  d: 1 }, { n: 76, t: 9,  d: 1 }, { n: 72, t: 10, d: 2 }, // Am
      { n: 77, t: 12, d: 1 }, { n: 72, t: 13, d: 1 }, { n: 69, t: 14, d: 2 }, // F
    ];
    const ROOTS = [48, 43, 45, 41];   // C3 G2 A2 F2, one per bar
    const ev = [];

    MELODY.forEach((o) =>
      ev.push({ t: at(o.t), play: (s) => voice('triangle', o.n, s, at(o.d) * 0.92, 0.3, null, true) }));

    for (let bar = 0; bar < 4; bar++) {
      const r = ROOTS[bar];
      const b = bar * 4;
      // Warm root–fifth half notes
      ev.push({ t: at(b),     play: (s) => voice('triangle', r,     s, CBEAT * 1.9, 0.32, bassFilter, true) });
      ev.push({ t: at(b + 2), play: (s) => voice('triangle', r + 7, s, CBEAT * 1.9, 0.3,  bassFilter, true) });
      // Open, gentle groove
      [0, 2].forEach((k) => ev.push({ t: at(b + k), play: (s) => drum('kick', s) }));
      ev.push({ t: at(b + 2), play: (s) => drum('snare', s) });
      [0, 1, 2, 3].forEach((k) => ev.push({ t: at(b + k), play: (s) => drum('hat', s) }));
    }
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, dur: at(16) };   // 16 beats (slower → longer)
  }

  // Bridge (1 bar at intermediate tempo — rising scale + snare roll)
  function sectionBridge() {
    const TBEAT = 60 / 120;   // 120 BPM — halfway between verse and chorus
    const at = (beat) => beat * TBEAT;
    const ev = [];

    // Rising lead A4→B4→C5→D5→E5→F5→G5→C6, climbing into C major
    const RISE = [69, 71, 72, 74, 76, 77, 79, 84];
    for (let i = 0; i < 8; i++) {
      const t = at(i * 0.5);
      ev.push({ t, play: (s) => voice('triangle', RISE[i], s, TBEAT * 0.38, 0.24 + i * 0.012, null, true) });
    }

    // Sustained bass A → holds through the bridge
    ev.push({ t: 0, play: (s) => voice('triangle', 45, s, TBEAT * 3.8, 0.28, bassFilter) });

    // Snare roll: eighths for first 2 beats, sixteenths for last 2 (builds energy)
    for (let i = 0; i < 4; i++) ev.push({ t: at(i * 0.5), play: (s) => drum('snare', s) });
    for (let i = 0; i < 8; i++) ev.push({ t: at(2 + i * 0.25), play: (s) => drum('snare', s) });

    // Kick anchors on 1 and 3
    [0, 2].forEach((k) => ev.push({ t: at(k), play: (s) => drum('kick', s) }));

    ev.sort((a, b) => a.t - b.t);
    return { events: ev, dur: at(4) };   // 4 beats = 2 s
  }

  // Stitch A×N + bridge + B into one looping timeline.
  function buildBattle() {
    const A = sectionA();
    const T = sectionBridge();
    const B = sectionB();
    const ev = [];
    let off = 0;
    for (let r = 0; r < A_REPEATS; r++) {
      A.events.forEach((e) => ev.push({ t: e.t + off, play: e.play }));
      off += A.dur;
    }
    T.events.forEach((e) => ev.push({ t: e.t + off, play: e.play }));
    off += T.dur;
    B.events.forEach((e) => ev.push({ t: e.t + off, play: e.play }));
    off += B.dur;
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, dur: off };
  }

  // ── Look-ahead scheduler (keeps ~0.12 s queued so stop is snappy)
  function tick() {
    if (!playing || !loopEvents) return;
    const now = ctx.currentTime;
    // If the tab was backgrounded, setInterval throttles while ctx time keeps
    // advancing. Re-sync to the current loop so we don't dump a backlog of
    // notes all at once (which sounded like random sound effects).
    if (now - loopBase > loopDur) {
      loopBase += Math.floor((now - loopBase) / loopDur) * loopDur;
    }
    const horizon = now + 0.12;
    let guard = 0;
    while (guard++ < 2048) {
      const ev = loopEvents[evIndex];
      const when = loopBase + ev.t;
      if (when >= horizon) break;
      if (when >= now - 0.04) ev.play(when);   // skip any note already in the past
      if (++evIndex >= loopEvents.length) { evIndex = 0; loopBase += loopDur; }
    }
  }

  function stopBattle() {
    playing = false;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  // ── One-shot jingles ──────────────────────────────────────
  function playOnce(notes) {
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((n) => {
      if (n.drum) drum(n.drum, t0 + n.t);
      else voice(n.type || 'triangle', n.n, t0 + n.t, n.d, n.g != null ? n.g : 0.28, null, n.squish);
    });
  }

  function victoryNotes() {
    return [
      // bouncy blob "bloops" climbing up
      { n: 67, t: 0.00, d: 0.12, squish: true }, { n: 72, t: 0.12, d: 0.12, squish: true },
      { n: 76, t: 0.24, d: 0.12, squish: true }, { n: 79, t: 0.36, d: 0.12, squish: true },
      { n: 84, t: 0.48, d: 0.30, squish: true },
      // triumphant held C-major chord
      { n: 72, t: 0.85, d: 1.1, g: 0.18 }, { n: 76, t: 0.85, d: 1.1, g: 0.18 },
      { n: 79, t: 0.85, d: 1.1, g: 0.18 }, { n: 84, t: 0.85, d: 1.1, g: 0.22 },
      { drum: 'kick', t: 0.0 }, { drum: 'snare', t: 0.36 },
      { drum: 'kick', t: 0.48 }, { drum: 'snare', t: 0.85 }, { drum: 'snare', t: 0.95 },
    ];
  }

  function defeatNotes() {
    // sad descending "wah-wah" into a low minor chord
    return [
      { n: 69, t: 0.00, d: 0.34, type: 'sawtooth', g: 0.2 },
      { n: 68, t: 0.36, d: 0.34, type: 'sawtooth', g: 0.2 },
      { n: 67, t: 0.72, d: 0.34, type: 'sawtooth', g: 0.2 },
      { n: 65, t: 1.08, d: 0.55, type: 'sawtooth', g: 0.2 },
      // low A-minor chord, slightly detuned for gloom
      { n: 45, t: 1.75, d: 1.6, type: 'square', g: 0.16 },
      { n: 48, t: 1.75, d: 1.6, type: 'square', g: 0.14 },
      { n: 52, t: 1.75, d: 1.6, type: 'square', g: 0.14 },
      { drum: 'kick', t: 0.0 }, { drum: 'kick', t: 1.08 }, { drum: 'kick', t: 1.75 },
    ];
  }

  // ── Public API ────────────────────────────────────────────
  function startBattle() {
    wantBattle = true;
    ensureCtx();
    if (ctx.state !== 'running') { ctx.resume(); return; } // will start on unlock
    const song = buildBattle();
    loopEvents = song.events;
    loopDur    = song.dur;
    loopBase   = ctx.currentTime + 0.1;
    evIndex    = 0;
    if (schedTimer) clearInterval(schedTimer);
    playing = true;
    schedTimer = setInterval(tick, 25);
  }

  function victory() {
    wantBattle = false;
    stopBattle();
    if (!ctx || ctx.state !== 'running') return;
    playOnce(victoryNotes());
  }

  function defeat() {
    wantBattle = false;
    stopBattle();
    if (!ctx || ctx.state !== 'running') return;
    playOnce(defeatNotes());
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  // Browsers block audio until a user gesture; unlock on the first one.
  function unlock() {
    ensureCtx();
    if (ctx.state !== 'running') ctx.resume();
    if (wantBattle && !playing) startBattle();
  }
  ['pointerdown', 'keydown'].forEach((e) =>
    window.addEventListener(e, unlock, { once: false }));

  return { startBattle, victory, defeat, toggleMute };
})();
