// Text-to-speech (speak) and all synthesised Web Audio sound effects.


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
        utter.onend = () => btnEl.classList.remove('speaking');
        utter.onerror = () => btnEl.classList.remove('speaking');
      }
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

  function playCorrectSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playNote(ctx, 523.25, now, 0.12, 'sine');
    playNote(ctx, 659.25, now + 0.09, 0.16, 'sine');
  }

  function playWrongSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playNote(ctx, 196, now, 0.25, 'sawtooth');
  }

  function playAchievementSound() {
    if (!state.progress.settings.soundEffects) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playNote(ctx, 523.25, now, 0.12, 'triangle');
    playNote(ctx, 659.25, now + 0.1, 0.12, 'triangle');
    playNote(ctx, 783.99, now + 0.2, 0.2, 'triangle');
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
