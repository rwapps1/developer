// Progress load/save, XP and level maths, and SRS box helpers.
// MUST load before state.js — state.js calls loadProgress() immediately
// when the state object is constructed.


  function defaultProgress() {
    return {
      wordStats: {},
      verbStats: {},
      streak: { current: 0, best: 0 },
      conjugateStreak: { current: 0, best: 0 },
      lifetime: { totalAnswered: 0, totalCorrect: 0 },
      conjugateLifetime: { totalAnswered: 0, totalCorrect: 0 },
      timeAttackBest: 0,
      taLifetime: { totalAnswered: 0, totalCorrect: 0 },
      memoryBest: {},
      memoryLifetime: { boardsCleared: 0, bySize: { '6': 0, '8': 0, '12': 0 } },
      memoryClearedSizes: {},
      streamLifetime: { totalAnswered: 0, totalCorrect: 0, checkpointsCompleted: 0, audioCorrect: 0 },
      masteredWordsCount: 0, // words that have EVER reached box 6 — permanent, never drops if a word later regresses (see ws.masteredEver)
      settings: { direction: 'mixed', roundLength: '10', autoSpeak: true, answerMode: 'choice', soundEffects: true, memoryGridSize: '8' },
      achievements: {},
      dailyDoubleLastHandled: null, // 'YYYY-MM-DD' of last Play/Skip decision, local device date
      dailyDoubleBonusXP: 0,        // cumulative bonus from completed Daily Double rounds
    };
  }

  function achievementIdsForGroup(group) {
    const allIds = Object.keys(ACHIEVEMENTS);
    if (group.prefix === null) {
      const otherPrefixes = ACHIEVEMENT_GROUPS.filter(g => g.prefix).map(g => g.prefix);
      return allIds.filter(id => !otherPrefixes.some(p => id.startsWith(p)));
    }
    return allIds.filter(id => id.startsWith(group.prefix));
  }

  function computeXP(progress) {
    let xp = 0;
    xp += progress.lifetime.totalCorrect * XP_PER_QUIZ_CORRECT;
    xp += progress.conjugateLifetime.totalCorrect * XP_PER_CONJUGATE_CORRECT;
    xp += progress.taLifetime.totalCorrect * XP_PER_TIMEATTACK_CORRECT;

    const bySize = (progress.memoryLifetime && progress.memoryLifetime.bySize) || {};
    let trackedBoards = 0;
    Object.keys(XP_MEMORY_BOARD).forEach(size => {
      const count = bySize[size] || 0;
      trackedBoards += count;
      xp += count * XP_MEMORY_BOARD[size];
    });
    // Boards cleared before per-size tracking existed still count, just at
    // a flat rate since we don't know what size they were.
    const totalBoards = (progress.memoryLifetime && progress.memoryLifetime.boardsCleared) || 0;
    const legacyBoards = Math.max(0, totalBoards - trackedBoards);
    xp += legacyBoards * XP_MEMORY_LEGACY;

    xp += progress.streak.best * XP_PER_BEST_STREAK_POINT;
    xp += progress.conjugateStreak.best * XP_PER_BEST_STREAK_POINT;

    const achievementsUnlocked = Object.values(progress.achievements || {}).filter(a => a && a.unlocked).length;
    xp += achievementsUnlocked * XP_PER_ACHIEVEMENT;

    xp += progress.dailyDoubleBonusXP || 0;

    return Math.round(xp);
  }

  // Walks the compounding-XP curve to find the current level and progress
  // toward the next one. Cheap even at very high XP totals since it stops
  // the moment the cumulative threshold passes the current amount.
  function getXPLevel(progress) {
    const xp = computeXP(progress);
    let span = XP_LEVEL_BASE_SPAN;
    let cumulative = 0;
    let level = 1;
    while (cumulative + span <= xp) {
      cumulative += span;
      level += 1;
      span = Math.round(span * XP_LEVEL_GROWTH);
    }
    const xpIntoLevel = xp - cumulative;
    const pct = Math.max(0, Math.min(100, Math.round((xpIntoLevel / span) * 100)));
    return { xp, level, xpIntoLevel, xpForNextLevel: span, pct };
  }

  function normalizeWordStats(wordStats) {
    // One-time migration: some words used to carry a disambiguator baked
    // into the English cell, e.g. "to be (essential)" - that text now
    // lives in a separate Note column, so the English cell (and therefore
    // this word's key) is clean. Rename any stored key still using the old
    // parenthetical form so existing box/streak progress carries over
    // rather than looking reset. Harmless no-op for verbStats, whose keys
    // are `es::personIndex` and never contain parentheses.
    Object.keys(wordStats).forEach(oldKey => {
      const sep = oldKey.indexOf('::');
      if (sep === -1) return;
      const esPart = oldKey.slice(0, sep);
      const enPart = oldKey.slice(sep + 2);
      const strippedEn = enPart.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (!strippedEn || strippedEn === enPart) return;
      const newKey = esPart + '::' + strippedEn;
      if (newKey === oldKey || wordStats[newKey]) return;
      wordStats[newKey] = wordStats[oldKey];
      delete wordStats[oldKey];
    });

    Object.keys(wordStats).forEach(key => {
      const ws = wordStats[key];
      if (typeof ws.box !== 'number') {
        const right = ws.right || 0;
        const wrong = ws.wrong || 0;
        ws.box = wrong > 0 ? 0 : Math.min(right, SRS_INTERVALS_DAYS.length - 1);
        ws.nextDue = 0;
        ws.lastSeen = ws.lastSeen || 0;
      }
    });
    return wordStats;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const merged = defaultProgress();
      merged.wordStats = normalizeWordStats(parsed.wordStats || {});
      merged.verbStats = normalizeWordStats(parsed.verbStats || {});
      merged.streak = Object.assign(merged.streak, parsed.streak || {});
      merged.conjugateStreak = Object.assign(merged.conjugateStreak, parsed.conjugateStreak || {});
      merged.lifetime = Object.assign(merged.lifetime, parsed.lifetime || {});
      merged.conjugateLifetime = Object.assign(merged.conjugateLifetime, parsed.conjugateLifetime || {});
      merged.timeAttackBest = typeof parsed.timeAttackBest === 'number' ? parsed.timeAttackBest : 0;
      merged.masteredWordsCount = typeof parsed.masteredWordsCount === 'number' ? parsed.masteredWordsCount : 0;
      merged.taLifetime = Object.assign(merged.taLifetime, parsed.taLifetime || {});
      merged.memoryBest = Object.assign({}, parsed.memoryBest || {});
      merged.memoryLifetime = Object.assign(merged.memoryLifetime, parsed.memoryLifetime || {});
      merged.streamLifetime = Object.assign(merged.streamLifetime, parsed.streamLifetime || {});
      merged.memoryClearedSizes = Object.assign({}, parsed.memoryClearedSizes || {});
      merged.settings = Object.assign(merged.settings, parsed.settings || {});
      merged.achievements = Object.assign({}, parsed.achievements || {});
      merged.dailyDoubleLastHandled = typeof parsed.dailyDoubleLastHandled === 'string' ? parsed.dailyDoubleLastHandled : null;
      merged.dailyDoubleBonusXP = typeof parsed.dailyDoubleBonusXP === 'number' ? parsed.dailyDoubleBonusXP : 0;
      return merged;
    } catch (e) {
      return defaultProgress();
    }
  }

  // Detects a level-up the instant it happens, from wherever it happens —
  // saveProgress() is already called after every stat-changing action
  // across all four games, so this one hook covers everything without
  // touching each game engine individually. Doesn't show anything itself;
  // just flags it, so the actual celebration can wait for a safe moment
  // (see leaveResults() below) rather than interrupting live play.
  function checkLevelUp() {
    const level = getXPLevel(state.progress).level;
    if (state.lastKnownLevel === null) {
      // First check this session — establish the baseline, don't celebrate
      // whatever level the account already happened to be at.
      state.lastKnownLevel = level;
      return;
    }
    if (level > state.lastKnownLevel) {
      state.pendingLevelUp = level;
      state.lastKnownLevel = level;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch (e) {
      // storage unavailable (private browsing etc.) - fail silently
    }
    state.progressDirty = true;
    pushCloudProgressDebounced();
    checkLevelUp();
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palabra-progress.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importProgress(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const merged = defaultProgress();
        merged.wordStats = normalizeWordStats(parsed.wordStats || {});
        merged.verbStats = normalizeWordStats(parsed.verbStats || {});
        merged.streak = Object.assign(merged.streak, parsed.streak || {});
        merged.conjugateStreak = Object.assign(merged.conjugateStreak, parsed.conjugateStreak || {});
        merged.lifetime = Object.assign(merged.lifetime, parsed.lifetime || {});
        merged.conjugateLifetime = Object.assign(merged.conjugateLifetime, parsed.conjugateLifetime || {});
        merged.timeAttackBest = typeof parsed.timeAttackBest === 'number' ? parsed.timeAttackBest : 0;
        merged.masteredWordsCount = typeof parsed.masteredWordsCount === 'number' ? parsed.masteredWordsCount : 0;
        merged.taLifetime = Object.assign(merged.taLifetime, parsed.taLifetime || {});
        merged.memoryBest = Object.assign({}, parsed.memoryBest || {});
        merged.memoryLifetime = Object.assign(merged.memoryLifetime, parsed.memoryLifetime || {});
        merged.streamLifetime = Object.assign(merged.streamLifetime, parsed.streamLifetime || {});
        merged.memoryClearedSizes = Object.assign({}, parsed.memoryClearedSizes || {});
        merged.settings = Object.assign(merged.settings, parsed.settings || {});
        merged.achievements = Object.assign({}, parsed.achievements || {});
        merged.dailyDoubleLastHandled = typeof parsed.dailyDoubleLastHandled === 'string' ? parsed.dailyDoubleLastHandled : null;
        merged.dailyDoubleBonusXP = typeof parsed.dailyDoubleBonusXP === 'number' ? parsed.dailyDoubleBonusXP : 0;
        state.progress = merged;
        saveProgress();
        render();
      } catch (e) {
        alert("That file doesn't look like a valid progress export.");
      }
    };
    reader.readAsText(file);
  }

  // ---- My Progress helpers ----

  // Counts how many stats entries sit in each of the 6 SRS boxes. Works for
  // both wordStats and verbStats (same shape). Used for the box-distribution
  // bars on the My Progress screen.
  function boxCounts(statsObj) {
    const counts = [0, 0, 0, 0, 0, 0];
    Object.keys(statsObj).forEach(key => {
      const box = statsObj[key].box || 0;
      if (box >= 0 && box < counts.length) counts[box] += 1;
    });
    return counts;
  }
