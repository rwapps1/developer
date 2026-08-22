// Achievement toasts, unlocking, round-achievement evaluation, and the
// canvas-particle effects (confetti, streak embers, achievement sparkle).

  function reduceMotionFX() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Monotonic id so each achievement toast's SVG gradient has a unique
  // <linearGradient> id — two toasts can be on screen briefly during the
  // fade-out/fade-in handoff (see flushQueuedAchievementToasts()), and
  // duplicate SVG ids would make both toasts render whichever gradient
  // the browser resolves first.
  let toastSeq = 0;

  function showAchievementToast(id) {
    const def = ACHIEVEMENTS[id];
    if (!def) return;
    const gradId = 'hexGradient-' + (toastSeq++);
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <div class="toast-badge">
        <canvas class="achievement-sparkle-canvas"></canvas>
        <svg class="badge-hex" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--ochre)"></stop>
              <stop offset="100%" stop-color="var(--label)"></stop>
            </linearGradient>
          </defs>
          <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="url(#${gradId})" stroke="rgba(255,255,255,0.4)" stroke-width="2"></polygon>
        </svg>
        <div class="badge-hex-icon">${def.icon}</div>
        <div class="badge-shine"></div>
      </div>
      <div class="toast-copy">
        <div class="toast-title">Achievement unlocked</div>
        <div class="toast-name">${esc(def.name)}</div>
      </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
      const badge = toast.querySelector('.toast-badge');
      if (badge) badge.classList.add('play');
      setTimeout(() => triggerAchievementSparkle(toast), 250);
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 2600);
  }

  function showComingSoonToast(icon, name) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div><div class="toast-title">Coming soon</div><div class="toast-name">${esc(name)}</div></div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('show'); });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 2000);
  }

  // One-time-per-day toast for hitting the Daily XP goal — see
  // checkDailyGoalCrossed() in progress-xp.js. Deliberately quieter than
  // an achievement unlock (no sound, no confetti): reaching a routine
  // daily goal is a nice nudge, not a milestone worth the bigger fanfare.
  function showDailyGoalToast() {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<div class="toast-icon">⚡</div><div><div class="toast-title">Daily goal reached</div><div class="toast-name">You hit your XP goal for today</div></div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('show'); });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 2600);
  }

  // While true, unlockAchievement() queues its toast/sound instead of
  // firing immediately — used around round-end achievement checks so an
  // achievement toast doesn't pop up on top of the full-screen celebration.
  // The unlock itself (and saveProgress) still happens right away either way.
  let suppressAchievementFX = false;

  function unlockAchievement(id) {
    if (!ACHIEVEMENTS[id]) return false;
    if (!state.progress.achievements) state.progress.achievements = {};
    if (state.progress.achievements[id] && state.progress.achievements[id].unlocked) return false;
    state.progress.achievements[id] = { unlocked: true, unlockedAt: Date.now() };
    saveProgress();
    if (suppressAchievementFX) {
      state.queuedAchievementToasts.push(id);
    } else {
      playAchievementSound();
      showAchievementToast(id);
    }
    return true;
  }

  // Shows any achievement toasts that were queued during a round-end
  // celebration, once that celebration has finished or been skipped.
  function flushQueuedAchievementToasts() {
    if (!state.queuedAchievementToasts.length) return;
    const ids = state.queuedAchievementToasts;
    state.queuedAchievementToasts = [];
    playAchievementSound();
    let delay = 0;
    ids.forEach((id) => {
      setTimeout(() => showAchievementToast(id), delay);
      delay += 250;
    });
  }

  // Picks the locked achievement with the highest completion fraction, for
  // the hub Today panel's "N away from X" teaser. Only achievements listed
  // in ACHIEVEMENT_PROGRESS (config.js) are eligible — see that table's
  // comment for why one-shot/session-only achievements are excluded.
  // Returns null if every eligible achievement is already unlocked (or
  // none exist yet, e.g. mid-migration).
  function getAchievementTeaser() {
    const progress = state.progress;
    const unlocked = progress.achievements || {};
    let best = null;
    Object.keys(ACHIEVEMENT_PROGRESS).forEach(id => {
      if (unlocked[id] && unlocked[id].unlocked) return;
      const def = ACHIEVEMENTS[id];
      const spec = ACHIEVEMENT_PROGRESS[id];
      if (!def || !spec) return;
      const value = spec.value(progress) || 0;
      const fraction = Math.max(0, Math.min(1, value / spec.target));
      const remaining = Math.max(0, Math.ceil(spec.target - value));
      if (!best || fraction > best.fraction) {
        best = { id, def, fraction, remaining };
      }
    });
    return best;
  }

  function evaluateRoundAchievements() {
    const score = state.results.filter(r => r.correct).length;
    const total = state.results.length;
    unlockAchievement('firstRound');
    if (total > 0 && score === total) unlockAchievement('perfectRound');
    if (state.questions.length >= 50) unlockAchievement('bigRound');
    if (state.progress.settings.roundLength === 'all') unlockAchievement('allWords');
  }

  // ---- Canvas particle engine ----
  //
  // Shared by all three particle effects below (confetti shower, streak
  // embers, achievement sparkle burst): gravity + horizontal sway per
  // particle rather than a single canned CSS animation, so it reads as
  // physics rather than one repeating clip. Each call gets its own
  // instance scoped to one canvas — no shared/module-level animation
  // state, so multiple effects can run concurrently without stepping on
  // each other.
  function createParticles(canvas) {
    const ctx2d = canvas.getContext('2d');
    let particles = [];
    let animId = null;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function addParticle(p) { particles.push(p); if (!animId) step(); }

    // Falls from above the top edge with gravity + gentle side-to-side
    // sway — the confetti shower.
    function shower(opts) {
      resize();
      const w = canvas.clientWidth;
      for (let i = 0; i < opts.count; i++) {
        addParticle({
          x: Math.random() * w, y: -20 - Math.random() * 100,
          vx: (Math.random() - 0.5) * 0.6,
          vy: opts.fallMin + Math.random() * (opts.fallMax - opts.fallMin),
          swayAmp: 0.3 + Math.random() * 0.7, swayFreq: 0.015 + Math.random() * 0.02, swayPhase: Math.random() * Math.PI * 2,
          size: opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin),
          color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.25,
          life: 0, maxLife: opts.life * (0.8 + Math.random() * 0.5),
          gravity: opts.gravity, shape: Math.random() > 0.5 ? 'rect' : 'circle'
        });
      }
    }

    // Rises from a fixed origin with negative gravity (drifts upward),
    // glowing and flickering — the streak fire embers.
    function embers(opts) {
      resize();
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const ox = w * opts.originX, oy = h * opts.originY;
      for (let i = 0; i < opts.count; i++) {
        addParticle({
          x: ox + (Math.random() - 0.5) * opts.spreadX,
          y: oy + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(opts.riseMin + Math.random() * (opts.riseMax - opts.riseMin)),
          swayAmp: 0.4 + Math.random() * 0.9, swayFreq: 0.03 + Math.random() * 0.03, swayPhase: Math.random() * Math.PI * 2,
          size: opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin),
          color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
          rot: 0, vr: 0,
          life: 0, maxLife: opts.life * (0.7 + Math.random() * 0.6),
          gravity: 0.012, shape: 'circle', glow: true, flicker: true
        });
      }
    }

    // Explodes outward from a fixed origin (mostly upward, ±~103°) with
    // real gravity pulling it back down — the achievement sparkle burst.
    function burst(opts) {
      resize();
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const ox = w * opts.originX, oy = h * opts.originY;
      for (let i = 0; i < opts.count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
        const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
        addParticle({
          x: ox, y: oy,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          swayAmp: 0, swayFreq: 0, swayPhase: 0,
          size: opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin),
          color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.35,
          life: 0, maxLife: opts.life * (0.7 + Math.random() * 0.6),
          gravity: opts.gravity, shape: Math.random() > 0.5 ? 'rect' : 'circle'
        });
      }
    }

    function step() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx2d.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.vy += p.gravity;
        p.x += p.vx + Math.sin(p.life * p.swayFreq + p.swayPhase) * p.swayAmp;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        const fadeStart = p.maxLife * 0.75;
        let alpha = p.life > fadeStart ? Math.max(0, 1 - (p.life - fadeStart) / (p.maxLife - fadeStart)) : 1;
        if (p.flicker) alpha *= 0.65 + Math.random() * 0.35;
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.rot);
        ctx2d.globalAlpha = Math.max(0, alpha);
        ctx2d.fillStyle = p.color;
        if (p.glow) {
          ctx2d.shadowColor = p.color;
          ctx2d.shadowBlur = 8;
        }
        if (p.shape === 'rect') {
          ctx2d.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx2d.beginPath();
          ctx2d.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.restore();
      });
      particles = particles.filter(p => p.life < p.maxLife && p.y < h + 40 && p.y > -60);
      if (particles.length > 0) {
        animId = requestAnimationFrame(step);
      } else {
        ctx2d.clearRect(0, 0, w, h);
        animId = null;
      }
    }

    return { shower, embers, burst };
  }

  // Creates a fresh fixed full-viewport canvas, appends it to <body>, and
  // removes it again after `lifespanMs` — used for the two whole-screen
  // particle effects (confetti, embers), which only ever run one at a
  // time and don't need to persist between calls.
  function createFullscreenFxCanvas(lifespanMs) {
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas-layer';
    document.body.appendChild(canvas);
    setTimeout(() => canvas.remove(), lifespanMs);
    return canvas;
  }

  // Perfect Round confetti — real gravity + sway per piece instead of a
  // single canned CSS fall, so it reads as an actual shower rather than
  // one repeating clip.
  function launchConfetti() {
    if (reduceMotionFX()) return;
    const canvas = createFullscreenFxCanvas(3500);
    const fx = createParticles(canvas);
    fx.shower({
      count: 70,
      colors: ['#2bbfa0', '#e8a33d', '#e8607f', '#a58ce0', '#f5c25a'],
      fallMin: 1.4, fallMax: 3.2, sizeMin: 6, sizeMax: 12,
      gravity: 0.05, life: 220
    });
  }

  // Streak checkpoint embers — called from renderStreamCheckpoint()
  // (render-quiz.js). Spawned in short waves rather than all at once so
  // the drift feels alive instead of one static puff.
  function emitStreakEmbers() {
    if (reduceMotionFX()) return;
    const canvas = createFullscreenFxCanvas(3200);
    const fx = createParticles(canvas);
    const waves = 9;
    for (let w = 0; w < waves; w++) {
      setTimeout(() => {
        fx.embers({
          count: 4, originX: 0.5, originY: 0.72, spreadX: 90,
          riseMin: 0.6, riseMax: 1.6, sizeMin: 3, sizeMax: 6,
          colors: ['#ff8a3d', '#ffce6b', '#e84632'], life: 130
        });
      }, w * 200);
    }
  }

  // Small gold sparkle burst around the achievement toast's hex badge,
  // timed just after the badge's shine-sweep starts (see showAchievement
  // Toast() above). Scoped to the toast's own canvas, not full-screen.
  function triggerAchievementSparkle(toastEl) {
    if (reduceMotionFX()) return;
    const canvas = toastEl.querySelector('.achievement-sparkle-canvas');
    if (!canvas) return;
    const fx = createParticles(canvas);
    fx.burst({
      count: 22, colors: ['#f5b73d', '#ffd873', '#9a7bf5', '#ffffff'],
      originX: 0.5, originY: 0.5, speedMin: 1.5, speedMax: 4.2,
      sizeMin: 3, sizeMax: 6, gravity: 0.1, life: 55
    });
  }
