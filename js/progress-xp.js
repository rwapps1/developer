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
      dailyDoubleLastHandled: null, // 'YYYY-MM-DD' of last Play decision, local device date
      dailyDoubleBonusXP: 0,        // cumulative bonus from completed Daily Double rounds
      dailyXPGoal: DEFAULT_DAILY_XP_GOAL, // user-adjustable, default 60
      dailyStreak: { current: 0, best: 0 }, // daily login/practice streak (distinct from in-session answer streak)
      lastActiveDate: null,         // 'YYYY-MM-DD' of the last day with qualifying activity — gates the streak increment
      recentActiveDates: [],        // trimmed list of qualifying-activity dates (last ~14), drives the week pip strip
      todaySnapshot: { date: null, xpAtStart: 0, answeredAtStart: 0 }, // baseline computeXP()/answered-count at the start of "today", used to derive today's XP/words live
      dailyGoalCelebratedDate: null, // 'YYYY-MM-DD' of the last day the "goal reached" toast was shown, so it only fires once per day
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

  // Reverse of achievementIdsForGroup() — which group does a given
  // achievement id belong to. Used to jump straight to an achievement's
  // detail screen (e.g. from the hub's "closest to unlocking" teaser)
  // instead of dropping the person on the top-level Achievements list.
  function groupIdForAchievement(id) {
    const prefixed = ACHIEVEMENT_GROUPS.find(g => g.prefix && id.startsWith(g.prefix));
    if (prefixed) return prefixed.id;
    const fallback = ACHIEVEMENT_GROUPS.find(g => g.prefix === null);
    return fallback ? fallback.id : ACHIEVEMENT_GROUPS[0].id;
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
      merged.dailyXPGoal = typeof parsed.dailyXPGoal === 'number' && parsed.dailyXPGoal > 0 ? parsed.dailyXPGoal : DEFAULT_DAILY_XP_GOAL;
      merged.dailyStreak = Object.assign(merged.dailyStreak, parsed.dailyStreak || {});
      merged.lastActiveDate = typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : null;
      merged.recentActiveDates = Array.isArray(parsed.recentActiveDates) ? parsed.recentActiveDates.slice(-14) : [];
      merged.todaySnapshot = Object.assign({}, merged.todaySnapshot, parsed.todaySnapshot || {});
      merged.dailyGoalCelebratedDate = typeof parsed.dailyGoalCelebratedDate === 'string' ? parsed.dailyGoalCelebratedDate : null;
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
      // Stash the pre-level-up value before overwriting it, so the Level
      // Up ring animation (renderLevelUp() in render-quiz.js) can draw
      // itself in from the real previous level rather than guessing
      // `level - 1` — a multi-level jump (e.g. a big XP grant) should
      // still show the actual prior number, not an approximation.
      state.pendingLevelUpFrom = state.lastKnownLevel;
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
    checkDailyGoalCrossed();
  }

  // Fires the one-time "daily XP goal reached" toast the moment today's XP
  // crosses progress.dailyXPGoal, mirroring checkLevelUp()'s pattern —
  // every XP-affecting write already funnels through saveProgress(), so
  // this one hook covers every source (answers, achievements, best-streak
  // bonuses) without touching each award site individually. Deliberately
  // does NOT call ensureTodaySnapshot()/getTodayXP() (progress-xp.js
  // helpers with their own saveProgress() side effect) to avoid re-entrant
  // saves — if today's snapshot genuinely isn't set yet this no-ops and
  // catches up on the next saveProgress() call, which in practice is only
  // ever moments away.
  function checkDailyGoalCrossed() {
    const today = todayDateString();
    if (state.progress.dailyGoalCelebratedDate === today) return;
    const snap = state.progress.todaySnapshot;
    if (!snap || snap.date !== today) return;
    const todayXP = Math.max(0, computeXP(state.progress) - snap.xpAtStart);
    const goal = state.progress.dailyXPGoal || DEFAULT_DAILY_XP_GOAL;
    if (todayXP >= goal) {
      state.progress.dailyGoalCelebratedDate = today;
      showDailyGoalToast();
    }
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
        merged.dailyXPGoal = typeof parsed.dailyXPGoal === 'number' && parsed.dailyXPGoal > 0 ? parsed.dailyXPGoal : DEFAULT_DAILY_XP_GOAL;
        merged.dailyStreak = Object.assign(merged.dailyStreak, parsed.dailyStreak || {});
        merged.lastActiveDate = typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : null;
        merged.recentActiveDates = Array.isArray(parsed.recentActiveDates) ? parsed.recentActiveDates.slice(-14) : [];
        merged.todaySnapshot = Object.assign({}, merged.todaySnapshot, parsed.todaySnapshot || {});
        merged.dailyGoalCelebratedDate = typeof parsed.dailyGoalCelebratedDate === 'string' ? parsed.dailyGoalCelebratedDate : null;
        state.progress = merged;
        saveProgress();
        render();
      } catch (e) {
        alert("That file doesn't look like a valid progress export.");
      }
    };
    reader.readAsText(file);
  }

  // ---- Today panel / daily streak helpers ----

  // True if `today` is exactly the calendar day after `dateStr` (both
  // 'YYYY-MM-DD', local device dates). Used to decide whether a new day's
  // activity continues the streak or resets it.
  function isNextCalendarDay(dateStr, today) {
    if (!dateStr) return false;
    const prev = new Date(dateStr + 'T00:00:00');
    const cur = new Date(today + 'T00:00:00');
    const diffDays = Math.round((cur - prev) / 86400000);
    return diffDays === 1;
  }

  // Called from the one qualifying-activity spot in each of the four game
  // engines (recordAnswer, recordConjugateAnswer, endMemoryMatch) — NOT
  // from every saveProgress(), so toggling a setting doesn't count as
  // "practiced today". Safe to call more than once per day; only the
  // first call each day does anything.
  function markDailyActivity() {
    const today = todayDateString();
    if (state.progress.lastActiveDate === today) return;
    const wasConsecutive = isNextCalendarDay(state.progress.lastActiveDate, today);
    state.progress.dailyStreak.current = wasConsecutive ? (state.progress.dailyStreak.current || 0) + 1 : 1;
    if (state.progress.dailyStreak.current > (state.progress.dailyStreak.best || 0)) {
      state.progress.dailyStreak.best = state.progress.dailyStreak.current;
    }
    state.progress.lastActiveDate = today;
    if (!state.progress.recentActiveDates) state.progress.recentActiveDates = [];
    if (!state.progress.recentActiveDates.includes(today)) {
      state.progress.recentActiveDates.push(today);
      if (state.progress.recentActiveDates.length > 14) {
        state.progress.recentActiveDates = state.progress.recentActiveDates.slice(-14);
      }
    }
  }

  // Rolls today's XP/words baseline forward whenever the local calendar
  // day has changed since it was last set — including just from opening
  // the app the next day, not only from new activity. computeXP() is
  // fully derived from lifetime counters (see above), so this snapshot-
  // diff approach needs no per-award hooks and stays correct even as new
  // XP sources get added to computeXP() in future.
  function ensureTodaySnapshot() {
    const today = todayDateString();
    if (state.progress.todaySnapshot && state.progress.todaySnapshot.date === today) return;
    state.progress.todaySnapshot = {
      date: today,
      xpAtStart: computeXP(state.progress),
      answeredAtStart: (state.progress.lifetime.totalAnswered || 0) + (state.progress.conjugateLifetime.totalAnswered || 0),
    };
    saveProgress();
  }

  function getTodayXP() {
    ensureTodaySnapshot();
    return Math.max(0, computeXP(state.progress) - state.progress.todaySnapshot.xpAtStart);
  }

  function getTodayWordsCount() {
    ensureTodaySnapshot();
    const total = (state.progress.lifetime.totalAnswered || 0) + (state.progress.conjugateLifetime.totalAnswered || 0);
    return Math.max(0, total - state.progress.todaySnapshot.answeredAtStart);
  }

  // Monday-start 7-day pip strip for the current calendar week (local
  // time). Each entry: { date, filled, isToday }.
  function getWeekPips() {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun..6=Sat
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const todayStr = todayDateString();
    const activeDates = state.progress.recentActiveDates || [];
    const pips = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      pips.push({ date: dateStr, filled: activeDates.includes(dateStr), isToday: dateStr === todayStr });
    }
    return pips;
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
