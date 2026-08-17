// Achievement toasts, unlocking, round-achievement evaluation, and confetti.


  function showAchievementToast(id) {
    const def = ACHIEVEMENTS[id];
    if (!def) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<div class="toast-icon">${def.icon}</div><div><div class="toast-title">Achievement unlocked</div><div class="toast-name">${esc(def.name)}</div></div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('show'); });
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
