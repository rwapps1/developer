// Memory Match mode rules and flow.


  function backToMemorySetup() {
    state.screen = 'memory-setup';
    render();
  }

  function clearMemoryTimerInterval() {
    if (state.memoryTimerHandle) {
      clearInterval(state.memoryTimerHandle);
      state.memoryTimerHandle = null;
    }
  }

  function clearMemoryFlipTimer() {
    if (state.memoryFlipTimer) {
      clearTimeout(state.memoryFlipTimer);
      state.memoryFlipTimer = null;
    }
  }

  function formatMemoryTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // A found match still nudges the word forward in the same spaced-repetition
  // schedule as a correct Quiz answer. It deliberately does NOT touch the shared
  // answer streak or lifetime totals - a memory slip isn't the same as a wrong
  // translation, and an easily-farmed match shouldn't inflate the streak that
  // Quiz/Time Attack achievements are built on.
  function recordMemoryMatch(pair) {
    const key = wordKey(pair);
    if (!state.progress.wordStats[key]) {
      state.progress.wordStats[key] = { box: 0, nextDue: 0, right: 0, wrong: 0, lastSeen: 0 };
    }
    const ws = state.progress.wordStats[key];
    const now = Date.now();
    ws.lastSeen = now;
    ws.es = primaryText(pair.es);
    ws.en = primaryText(pair.en);
    ws.right += 1;
    ws.box = Math.min((ws.box || 0) + 1, SRS_INTERVALS_DAYS.length - 1);
    ws.nextDue = now + SRS_INTERVALS_DAYS[ws.box] * 86400000;
  }

  function startMemoryMatch() {
    if (state.mainPool.length < 2) return;
    const gridSize = parseInt(state.progress.settings.memoryGridSize, 10);
    const pairCount = Math.min(gridSize, state.mainPool.length);
    const chosen = weightedSampleWithoutReplacement(state.mainPool, getWeight, pairCount);

    const tiles = [];
    chosen.forEach((pair, i) => {
      const esText = primaryText(pair.es);
      const enText = primaryText(pair.en);
      tiles.push({ pairIndex: i, lang: 'es', text: esText, matched: false, pair });
      tiles.push({ pairIndex: i, lang: 'en', text: enText, matched: false, pair });
    });

    state.memoryTiles = shuffle(tiles);
    state.memoryFlipped = [];
    state.memoryMatchedCount = 0;
    state.memoryTotalPairs = pairCount;
    state.memoryMoves = 0;
    state.memoryBusy = false;
    state.memoryStartTime = Date.now();
    state.memorySeconds = 0;
    state.memoryIsNewBest = false;
    state.memoryJustFlipped = [];
    state.memoryReacting = [];

    state.screen = 'memory-play';
    render();

    clearMemoryTimerInterval();
    state.memoryTimerHandle = setInterval(tickMemoryTimer, 1000);
  }

  function tickMemoryTimer() {
    state.memorySeconds = Math.floor((Date.now() - state.memoryStartTime) / 1000);
    const el = document.getElementById('memory-timer');
    if (el) el.textContent = formatMemoryTime(state.memorySeconds);
  }

  function flipMemoryTile(index) {
    if (state.memoryBusy) return;
    const tile = state.memoryTiles[index];
    if (!tile || tile.matched) return;
    if (state.memoryFlipped.includes(index)) return;
    if (state.memoryFlipped.length >= 2) return;

    state.memoryFlipped.push(index);

    if (state.memoryFlipped.length === 1) {
      state.memoryJustFlipped = [index];
      state.memoryReacting = [];
      render();
      return;
    }

    state.memoryMoves += 1;
    const [firstIdx, secondIdx] = state.memoryFlipped;
    const first = state.memoryTiles[firstIdx];
    const second = state.memoryTiles[secondIdx];

    if (first.pairIndex === second.pairIndex) {
      first.matched = true;
      second.matched = true;
      state.memoryMatchedCount += 1;
      recordMemoryMatch(first.pair);
      saveProgress();
      state.memoryFlipped = [];
      state.memoryJustFlipped = [secondIdx];
      state.memoryReacting = [firstIdx, secondIdx];
      playCorrectSound();
      render();

      if (state.memoryMatchedCount >= state.memoryTotalPairs) {
        clearMemoryTimerInterval();
        // Fires from a setTimeout with no tap directly behind it (the
        // matching tap happened 1200ms earlier) - wrap so showCelebration's
        // render() and the Celebrate -> Result auto-advance both get
        // replaceState() instead of pushState(). See runAsTimerAdvance in
        // navigation.js.
        setTimeout(() => { runAsTimerAdvance(endMemoryMatch); }, 1200);
      }
    } else {
      state.memoryBusy = true;
      state.memoryJustFlipped = [secondIdx];
      state.memoryReacting = [firstIdx, secondIdx];
      playWrongSound();
      render();
      clearMemoryFlipTimer();
      state.memoryFlipTimer = setTimeout(() => {
        state.memoryFlipped = [];
        state.memoryBusy = false;
        state.memoryJustFlipped = [firstIdx, secondIdx];
        render();
      }, 1500);
    }
  }

  function endMemoryMatch() {
    clearMemoryTimerInterval();
    clearMemoryFlipTimer();
    const gridSize = state.progress.settings.memoryGridSize;
    const prevBest = state.progress.memoryBest[gridSize];
    const isNewBest = !prevBest || state.memoryMoves < prevBest;
    if (isNewBest) {
      state.progress.memoryBest[gridSize] = state.memoryMoves;
    }
    markDailyActivity();
    state.progress.memoryLifetime.boardsCleared += 1;
    if (state.progress.memoryLifetime.bySize[gridSize] === undefined) {
      state.progress.memoryLifetime.bySize[gridSize] = 0;
    }
    state.progress.memoryLifetime.bySize[gridSize] += 1;
    state.progress.memoryClearedSizes[gridSize] = true;
    saveProgress();
    state.memoryIsNewBest = isNewBest;

    // "Perfect" used to mean zero mismatches, which is essentially a fluke
    // on anything but the smallest board. It now means a genuine new best
    // for this grid size — and only counts if there was a previous best to
    // beat, so a first-ever play on a grid size (which is always
    // technically "new best") never triggers it.
    const perfect = isNewBest && !!prevBest;
    const allSizesCleared = ['6', '8', '12'].every(size => state.progress.memoryClearedSizes[size]);
    suppressAchievementFX = true;
    unlockAchievement('memoryFirstWin');
    if (perfect) unlockAchievement('memoryPerfect');
    if (state.memoryTotalPairs === 6 && state.memorySeconds < 30) unlockAchievement('memoryFast6');
    if (state.memoryTotalPairs === 8 && state.memorySeconds < 50) unlockAchievement('memoryFast8');
    if (state.memoryTotalPairs === 12 && state.memorySeconds < 90) unlockAchievement('memoryFast');
    if (state.progress.memoryLifetime.boardsCleared >= 10) unlockAchievement('memoryBoards10');
    if (state.progress.memoryLifetime.boardsCleared >= 50) unlockAchievement('memoryBoards50');
    if (allSizesCleared) unlockAchievement('memoryAllSizes');
    suppressAchievementFX = false;

    showCelebration(perfect ? 'perfect' : 'finished', 'memory-result');
  }

  function quitMemoryMatch() {
    if (!confirm('Quit this board? Your progress on it will be lost.')) return;
    clearMemoryTimerInterval();
    clearMemoryFlipTimer();
    goHome();
  }
