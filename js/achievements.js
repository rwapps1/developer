// Achievement toasts, unlocking, round-achievement evaluation, and confetti.


  // One-shot canvas sparkle burst around the achievement badge, fired right
  // as the toast drops in. Deliberately self-contained (no shared particle
  // module) since this is the only place that needs it. Respects reduced
  // motion the same way launchConfetti() below does.
  function launchToastSparkle(canvas) {
    if (!canvas) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#FFC163', '#FFD873', '#C9A8FF', '#ffffff'];
    const originX = rect.width / 2, originY = rect.height / 2;
    const particles = [];
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      particles.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0, maxLife: 32 + Math.random() * 18
      });
    }

    function step() {
      ctx2d.clearRect(0, 0, rect.width, rect.height);
      let alive = false;
      particles.forEach(p => {
        if (p.life >= p.maxLife) return;
        alive = true;
        p.vy += 0.05;
        p.x += p.vx; p.y += p.vy; p.life++;
        ctx2d.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx2d.fillStyle = p.color;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx2d.fill();
      });
      if (alive) requestAnimationFrame(step);
      else ctx2d.clearRect(0, 0, rect.width, rect.height);
    }
    step();
  }

  // Achievement badge markup: a hexagonal medallion (gradient across the
  // app's ochre/purple palette) carrying the achievement's own icon, with a
  // light sheen sweeping across it on unlock. Kept as its own function since
  // showComingSoonToast/showDailyGoalToast below deliberately keep the
  // plainer .toast-icon treatment — this fancier badge is reserved for
  // genuine achievement unlocks.
  function achievementBadgeHtml(icon, uid) {
    return `
      <div class="toast-badge-hex">
        <canvas class="toast-sparkle-canvas"></canvas>
        <svg class="badge-hex-svg" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="toastHexGradient-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--ochre)"></stop>
              <stop offset="100%" stop-color="#8B5CF6"></stop>
            </linearGradient>
          </defs>
          <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="url(#toastHexGradient-${uid})" stroke="rgba(255,255,255,0.4)" stroke-width="2"></polygon>
          <text x="50" y="63" text-anchor="middle" font-size="42">${icon}</text>
        </svg>
        <div class="badge-shine"></div>
      </div>
    `;
  }

  function showAchievementToast(id) {
    const def = ACHIEVEMENTS[id];
    if (!def) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `${achievementBadgeHtml(def.icon, id)}<div><div class="toast-title">Achievement unlocked</div><div class="toast-name">${esc(def.name)}</div></div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
      launchToastSparkle(toast.querySelector('.toast-sparkle-canvas'));
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

  function launchConfetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const colors = ['#FFC163', '#FF4D6D', '#2DD4BF', '#C9A8FF'];
    const count = 44;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.35) + 's';
      piece.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
      piece.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      container.appendChild(piece);
    }
    setTimeout(() => { container.remove(); }, 3500);
  }
