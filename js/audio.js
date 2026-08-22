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

  // Shared short reverb (a decaying-noise impulse response through a
  // ConvolverNode) used by the achievement unlock sound's shimmer tail.
  // Cached per AudioContext instance since building the impulse buffer
  // isn't free and the context itself is a singleton (see getAudioCtx).
  let reverbNode = null;
  function getReverbNode(ctx) {
    if (reverbNode) return reverbNode;
    const duration = 1.6, decay = 3.2, rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    reverbNode = ctx.createConvolver();
    reverbNode.buffer = buffer;
    reverbNode.connect(ctx.destination);
    return reverbNode;
  }

  function playNote(ctx, freq, startTime, duration, type, peakGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain || 0.22, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // Brassier note for the "perfect round" fanfare: sawtooth + triangle
  // layered through a lowpass filter, rounding the sawtooth's harsh edge
  // into something closer to a horn than a chime.
  function playBrassNote(ctx, freq, startTime, duration, peakGain) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.7;
    filter.connect(ctx.destination);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    gain.connect(filter);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;
    osc1.connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq;
    osc2.connect(gain);

    osc1.start(startTime); osc1.stop(startTime + duration + 0.05);
    osc2.start(startTime); osc2.stop(startTime + duration + 0.05);
  }

  // Bright, percussive note used by the correct-answer ping and the
  // achievement-unlock sparkle: a quick upward pitch-glide into the target
  // frequency (rather than starting flat) plus a quiet inharmonic overtone
  // (not a clean octave) for a bell-ish sparkle instead of a smooth chime.
  function playPingNote(ctx, freq, startTime, duration, peakGain, overtoneRatio) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.88, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.018);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);

    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.value = freq * overtoneRatio;
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(peakGain * 0.4, startTime + 0.004);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.55);
    overtone.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);
    overtone.start(startTime);
    overtone.stop(startTime + duration * 0.55 + 0.05);
  }

  function playCorrectSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // tiny percussive click gives the attack a "tap" instead of a soft fade-in
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.value = 3400;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.05, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.03);

    // bright ascending major third (C6 -> E6) with a quick pitch-up glide
    // into each note — reads as a snappy, upbeat "ping" rather than a chime
    playPingNote(ctx, 1046.50, now + 0.004, 0.16, 0.3, 2.76);
    playPingNote(ctx, 1318.51, now + 0.095, 0.2, 0.32, 2.5);
  }

  function playWrongSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // low-pass everything so this stays soft and muted — deliberately the
    // opposite of the bright correct-answer ping above, and gentler than
    // the old single sawtooth buzz (which read as a harsh error beep on
    // repeat, more punishing than a "not quite yet" nudge should be)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.connect(ctx.destination);

    function dip(freq, startTime, duration, peakGain) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      // slight downward glide into the note — mirrors the correct sound's
      // upward glide, but descending, for a "deflating" rather than "no"
      osc.frequency.setValueAtTime(freq * 1.06, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    }

    // descending minor third (G4 -> Eb4) — reads as "not quite" rather
    // than an alarm, since this is the sound players hear most often
    dip(392.00, now, 0.22, 0.26);
    dip(311.13, now + 0.11, 0.32, 0.24);
  }

  function playAchievementSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const reverb = getReverbNode(ctx);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.3;
    wetGain.connect(reverb);

    // mechanical "unlock" tick — a short filtered noise burst, like a
    // lock actually opening, rather than just another chime
    const bufSize = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 4);
    const click = ctx.createBufferSource();
    click.buffer = buf;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 1800;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.35;
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);

    // low knock underneath the click for mechanical weight
    const knock = ctx.createOscillator();
    knock.type = 'sine';
    knock.frequency.setValueAtTime(180, now);
    knock.frequency.exponentialRampToValueAtTime(90, now + 0.06);
    const knockGain = ctx.createGain();
    knockGain.gain.setValueAtTime(0.0001, now);
    knockGain.gain.exponentialRampToValueAtTime(0.3, now + 0.005);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    knock.connect(knockGain);
    knockGain.connect(ctx.destination);
    knock.start(now);
    knock.stop(now + 0.1);

    // bright ascending three-note sparkle right after the unlock click
    playPingNote(ctx, 1046.50, now + 0.08, 0.18, 0.26, 2.8);
    playPingNote(ctx, 1318.51, now + 0.16, 0.2, 0.28, 2.6);
    playPingNote(ctx, 1760.00, now + 0.24, 0.35, 0.24, 2.4);

    // a touch of shimmer tail through the reverb send on the last note
    const tailOsc = ctx.createOscillator();
    tailOsc.type = 'sine';
    tailOsc.frequency.value = 1760.00;
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.0001, now + 0.24);
    tailGain.gain.exponentialRampToValueAtTime(0.1, now + 0.26);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.84);
    tailOsc.connect(tailGain);
    tailGain.connect(wetGain);
    tailOsc.start(now + 0.24);
    tailOsc.stop(now + 0.9);
  }

  // Round-end celebration sounds. Same gating convention as the other
  // sound effects (respects the Sound effects setting).
  function playPerfectFanfare() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // low thump under the badge pop-in, for weight
    playNote(ctx, 110, now, 0.2, 'sine', 0.2);
    // ascending bugle-call fanfare (sol-do-mi-sol-do): short-short-short-
    // short then a longer sustained landing note
    const notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
    const step = 0.11;
    notes.forEach((freq, i) => {
      const isLast = i === notes.length - 1;
      playBrassNote(ctx, freq, now + 0.05 + i * step, isLast ? 0.5 : 0.12, isLast ? 0.24 : 0.17);
    });
  }

  function playFinishedChime() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playNote(ctx, 110, now, 0.18, 'sine', 0.18);
    playNote(ctx, 523.25, now + 0.05, 0.16, 'triangle');
    playNote(ctx, 659.25, now + 0.15, 0.16, 'triangle');
    playNote(ctx, 783.99, now + 0.25, 0.18, 'triangle');
    playNote(ctx, 1046.5, now + 0.36, 0.32, 'triangle', 0.18);
  }

  // Level-up fanfare — an ascending trumpet-style call (same playBrassNote
  // instrument as the Perfect-round fanfare above) landing on a held final
  // note. Deliberately single-note voicing the whole way through, no
  // simultaneous chord and no gap before the landing note — both were
  // tried and ended up sounding like a different instrument bolted on
  // after a pause, rather than one continuous phrase.
  function playLevelUpFanfare() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playBrassNote(ctx, 110, now, 0.4, 0.24); // low brass foundation note
    const runNotes = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6
    const step = 0.14;
    runNotes.forEach((freq, i) => {
      const isLast = i === runNotes.length - 1;
      playBrassNote(ctx, freq, now + 0.12 + i * step, isLast ? 0.9 : 0.18, isLast ? 0.26 : 0.22);
    });
  }
