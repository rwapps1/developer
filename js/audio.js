// Text-to-speech (speak) and all synthesised Web Audio sound effects.

  // Holds whichever utterance is currently in flight. Never read anywhere
  // else — its only job is to keep a JS-side reference alive for as long
  // as speech might still be playing. Chrome/WebView has a documented bug
  // where, if the utterance created inside speak() below is the *only*
  // reference to it (a local variable, gone once speak() returns), the
  // garbage collector can silently kill in-flight speech with no error.
  // More likely to actually trigger in a memory-constrained context (like
  // the Android APK's TWA process) than in a full browser tab — matches
  // speech failing only in the APK, working fine in Chrome on the same
  // device.
  let activeUtterance = null;

  function speak(text, lang, btnEl) {
    if (!('speechSynthesis' in window)) return;
    try {
      // Chrome has a well-documented race condition where an unconditional
      // cancel() immediately followed by speak() can silently drop the
      // very first utterance of a session — the synthesis engine hasn't
      // "woken up" yet, and cancelling something that was never speaking
      // in the first place can still leave it in a state where the next
      // speak() call gets lost. Only cancel if something's actually
      // in-flight, and give the engine a brief moment before speaking
      // rather than calling speak() in the same synchronous tick as the
      // render that triggered it.
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.95;
      if (btnEl) {
        utter.onstart = () => btnEl.classList.add('speaking');
        utter.onend = () => { btnEl.classList.remove('speaking'); if (activeUtterance === utter) activeUtterance = null; };
        utter.onerror = () => { btnEl.classList.remove('speaking'); if (activeUtterance === utter) activeUtterance = null; };
      } else {
        utter.onend = () => { if (activeUtterance === utter) activeUtterance = null; };
        utter.onerror = () => { if (activeUtterance === utter) activeUtterance = null; };
      }
      activeUtterance = utter;
      setTimeout(() => {
        try { window.speechSynthesis.speak(utter); } catch (e) {}
      }, 50);
    } catch (e) {
      // speech is a nice-to-have, never let it break the quiz
    }
  }

  let audioCtx = null;
  function getAudioCtx() {
    if (!('AudioContext' in window || 'webkitAudioContext' in window)) return null;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // ---- Shared synthesis helpers (used by every sound effect below) ----

  // Generated-noise reverb tail, shared across all the celebration sounds
  // that use one (Perfect Round, Round Complete, Level Up, Achievement).
  // Built once per AudioContext and cached — a fresh ConvolverNode buffer
  // is a bit of work to generate and none of these sounds need a different
  // decay character from each other.
  let reverbNode = null;
  function getReverb(ctx) {
    if (reverbNode) return reverbNode;
    const duration = 1.8, decay = 3.4, rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    reverbNode = ctx.createConvolver();
    reverbNode.buffer = buffer;
    return reverbNode;
  }

  // Simple decaying note — one oscillator, exponential attack/release.
  // Used for chords, sustained pads, and reverb-tail sends.
  function pluck(ctx, { freq, start, dur = 0.25, type = 'sine', gain = 0.25, dest }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // Bright "ping" voice: a quick pitch-up glide into the target note (for
  // attack) plus an inharmonic overtone on triangle (for a bell-ish
  // sparkle rather than a clean, slightly dull octave).
  function ping(ctx, dest, { freq, start, dur = 0.18, gain = 0.3, overtone = 2.7 }) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.88, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.018);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * overtone;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, start);
    g2.gain.exponentialRampToValueAtTime(gain * 0.4, start + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.55);
    osc2.connect(g2);
    g2.connect(dest);
    osc2.start(start);
    osc2.stop(start + dur * 0.55 + 0.05);
  }

  // Short burst of filtered noise — the "crackle"/"click" texture shared
  // by the Streak fire sound and the Achievement unlock mechanism.
  // `shape` controls the decay curve (higher = snappier).
  function noiseBurst(ctx, dest, { start, dur, filterType, filterFreq, filterQ, gain, shape = 2 }) {
    const bufSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, shape);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    if (filterQ !== undefined) filt.Q.value = filterQ;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur);
    return src;
  }

  // Correct answer — a tiny percussive click (attack) followed by a
  // bright ascending major third (C6 → E6) using the ping() voice, so it
  // reads as an upbeat two-note pop rather than a flat chime.
  function playCorrectSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(ctx.destination);

    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.value = 3400;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, now);
    cg.gain.exponentialRampToValueAtTime(0.05, now + 0.002);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    click.connect(cg);
    cg.connect(dry);
    click.start(now);
    click.stop(now + 0.03);

    ping(ctx, dry, { freq: 1046.50, start: now + 0.004, dur: 0.16, gain: 0.32, overtone: 2.76 });
    ping(ctx, dry, { freq: 1318.51, start: now + 0.095, dur: 0.2, gain: 0.34, overtone: 2.5 });
  }

  // Incorrect answer — descending minor third (G4 → Eb4) through a
  // low-pass filter with a slight downward pitch glide into each note.
  // Deliberately soft/muted (the opposite of the correct sound's bright
  // upward ping) so it reads as "not quite" rather than a harsh buzzer,
  // even on the twentieth repeat of a session.
  function playWrongSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    dry.connect(ctx.destination);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1100;
    filt.connect(dry);

    function dip(freq, start, dur, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 1.06, start);
      osc.frequency.exponentialRampToValueAtTime(freq, start + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(filt);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }

    dip(392.00, now, 0.22, 0.26);
    dip(311.13, now + 0.11, 0.32, 0.24);
  }

  // Achievement unlocked — a mechanical "unlock" click (filtered noise)
  // plus a low knock for weight, then a bright ascending three-note
  // sparkle. Distinct from every other sound here on purpose: this is the
  // one moment that isn't a round-end or level milestone.
  function playAchievementSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    dry.connect(ctx.destination);

    const reverb = getReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    wet.connect(reverb);
    reverb.connect(ctx.destination);

    noiseBurst(ctx, dry, { start: now, dur: 0.05, filterType: 'highpass', filterFreq: 1800, gain: 0.35, shape: 4 });

    const knock = ctx.createOscillator();
    knock.type = 'sine';
    knock.frequency.setValueAtTime(180, now);
    knock.frequency.exponentialRampToValueAtTime(90, now + 0.06);
    const kg = ctx.createGain();
    kg.gain.setValueAtTime(0.0001, now);
    kg.gain.exponentialRampToValueAtTime(0.3, now + 0.005);
    kg.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    knock.connect(kg);
    kg.connect(dry);
    knock.start(now);
    knock.stop(now + 0.1);

    ping(ctx, dry, { freq: 1046.50, start: now + 0.08, dur: 0.18, gain: 0.26, overtone: 2.8 });
    ping(ctx, dry, { freq: 1318.51, start: now + 0.16, dur: 0.2, gain: 0.28, overtone: 2.6 });
    ping(ctx, dry, { freq: 1760.00, start: now + 0.24, dur: 0.35, gain: 0.24, overtone: 2.4 });
    pluck(ctx, { freq: 1760.00, start: now + 0.24, dur: 0.6, type: 'sine', gain: 0.1, dest: wet });
  }

  // Perfect round fanfare — a low thump under the badge pop-in, a rising
  // five-note arpeggio (each note doubled dry + into the reverb tail, plus
  // a quiet octave-up triangle layer for shimmer), landing on a sustained
  // four-note chord. The biggest sound in the app — every other
  // celebration is deliberately smaller than this one.
  function playPerfectFanfare() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    dry.connect(ctx.destination);

    const reverb = getReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    wet.connect(reverb);
    reverb.connect(ctx.destination);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(58, now + 0.18);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    thump.connect(tg);
    tg.connect(dry);
    thump.start(now);
    thump.stop(now + 0.25);

    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((f, i) => {
      const t = now + 0.12 + i * 0.075;
      pluck(ctx, { freq: f, start: t, dur: 0.3, type: 'sine', gain: 0.22, dest: dry });
      pluck(ctx, { freq: f, start: t, dur: 0.5, type: 'sine', gain: 0.14, dest: wet });
      pluck(ctx, { freq: f * 2, start: t, dur: 0.2, type: 'triangle', gain: 0.05, dest: dry });
    });

    const chordStart = now + 0.12 + notes.length * 0.075 + 0.05;
    const chord = [1046.50, 1318.51, 1568.00, 2093.00];
    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (idx - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, chordStart);
      g.gain.exponentialRampToValueAtTime(0.18, chordStart + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, chordStart + 1.4);
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(chordStart);
      osc.stop(chordStart + 1.5);
    });
  }

  // Round complete (non-perfect finish) — a warm two-note rise, rounder
  // and slower than the correct-answer ping, with a soft sustained chord
  // underneath. Enough to feel earned without competing with the Perfect
  // Round fanfare above.
  function playFinishedChime() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    dry.connect(ctx.destination);

    const reverb = getReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    wet.connect(reverb);
    reverb.connect(ctx.destination);

    pluck(ctx, { freq: 659.25, start: now, dur: 0.45, type: 'sine', gain: 0.28, dest: dry });
    pluck(ctx, { freq: 659.25, start: now, dur: 0.7, type: 'sine', gain: 0.16, dest: wet });
    pluck(ctx, { freq: 987.77, start: now + 0.16, dur: 0.55, type: 'sine', gain: 0.26, dest: dry });
    pluck(ctx, { freq: 987.77, start: now + 0.16, dur: 0.8, type: 'sine', gain: 0.18, dest: wet });

    [659.25, 987.77, 1318.51].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(now + 0.05);
      osc.stop(now + 1.2);
    });
  }

  // Stream checkpoint ("N in a row!") — a rising sawtooth "power-up"
  // whoosh through a sweeping lowpass filter, a short bandpass noise burst
  // for a fire-crackle texture, capped by two bright pings in the same
  // voice as the correct-answer sound (this is a streak of correct
  // answers, after all). No sound existed for this screen before.
  function playStreakSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 0.95;
    dry.connect(ctx.destination);

    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(160, now);
    sweep.frequency.exponentialRampToValueAtTime(720, now + 0.32);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(600, now);
    filt.frequency.exponentialRampToValueAtTime(3000, now + 0.32);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    sweep.connect(filt);
    filt.connect(sg);
    sg.connect(dry);
    sweep.start(now);
    sweep.stop(now + 0.36);

    noiseBurst(ctx, dry, { start: now, dur: 0.3, filterType: 'bandpass', filterFreq: 2200, filterQ: 0.8, gain: 0.18, shape: 2 });

    ping(ctx, dry, { freq: 1318.51, start: now + 0.3, dur: 0.28, gain: 0.3, overtone: 2.6 });
    ping(ctx, dry, { freq: 1567.98, start: now + 0.36, dur: 0.32, gain: 0.28, overtone: 2.4 });
  }

  // Level-up fanfare — a rising sine sweep timed to the level ring drawing
  // itself in (see animateLevelRing() in render-quiz.js), resolving into a
  // bright three-note chord exactly as the number flips to the new level.
  function playLevelUpFanfare() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    dry.connect(ctx.destination);

    const reverb = getReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    wet.connect(reverb);
    reverb.connect(ctx.destination);

    const sweep = ctx.createOscillator();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(220, now);
    sweep.frequency.exponentialRampToValueAtTime(880, now + 0.9);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.exponentialRampToValueAtTime(0.14, now + 0.15);
    sg.gain.setValueAtTime(0.14, now + 0.75);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    sweep.connect(sg);
    sg.connect(dry);
    sg.connect(wet);
    sweep.start(now);
    sweep.stop(now + 1.0);

    const chordStart = now + 0.92;
    [880.00, 1108.73, 1318.51].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 1 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, chordStart);
      g.gain.exponentialRampToValueAtTime(0.22, chordStart + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, chordStart + 0.9);
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(chordStart);
      osc.stop(chordStart + 1.0);
    });
  }
