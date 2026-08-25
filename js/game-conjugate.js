// Conjugate mode rules and flow, including verb-combo pool/round building.


  function verbComboKey(pair, personIndex) {
    return normalize(pair.es) + '::' + personIndex;
  }

  function getVerbComboWeight(combo) {
    const stats = state.progress.verbStats[verbComboKey(combo.pair, combo.person)];
    const now = Date.now();
    if (!stats) return 12;
    const overdueMs = now - (stats.nextDue || 0);
    if (overdueMs >= 0) {
      const overdueDays = overdueMs / 86400000;
      return 6 + Math.min(overdueDays, 12) * 1.5;
    }
    const daysUntilDue = -overdueMs / 86400000;
    return Math.max(0.2, 3 / (1 + daysUntilDue * 2));
  }

  function buildVerbComboPool() {
    const pool = [];
    state.verbPairs.forEach(pair => {
      validPersonsFor(pair.es).forEach(p => pool.push({ pair, person: p }));
    });
    return pool;
  }

  function buildConjugateRound(length) {
    const pool = buildVerbComboPool();
    let selected = [];
    while (selected.length < length && pool.length > 0) {
      const remaining = length - selected.length;
      const batchSize = Math.min(remaining, pool.length);
      const batch = weightedSampleWithoutReplacement(pool, getVerbComboWeight, batchSize);
      selected = selected.concat(batch);
    }
    return selected;
  }

  function getConjugateDistractors(combo, correctText, count) {
    const otherPersons = shuffle([0, 1, 2, 3, 4, 5].filter(p => p !== combo.person));
    const seen = new Set([normalize(correctText)]);
    const candidates = [];
    otherPersons.forEach(p => {
      const form = conjugatePresent(combo.pair.es, p);
      if (!form) return;
      const n = normalize(form);
      if (seen.has(n)) return;
      seen.add(n);
      candidates.push(form);
    });
    return candidates.slice(0, count);
  }

  // Verbs now come from the same sheet as everything else (rows tagged
  // "conjugation" - see isMainPoolEligible/pairHasCategory), already
  // derived into state.verbPairs whenever the word list loads (parseRows).
  // This just re-derives from whatever's currently in state.pairs - kept
  // around as a synchronous fallback for goToConjugateSetup, in case it's
  // ever reached before the word list has loaded.
  function loadVerbsFile() {
    state.verbsLoading = false;
    state.verbPairs = state.pairs.filter(p => pairHasCategory(p, 'conjugation'));
    if (state.verbPairs.length === 0) {
      state.verbsError = 'No verbs found. Make sure some rows in words.xlsx have "conjugation" in the Category column.';
      state.verbsLoaded = false;
    } else {
      state.verbsError = '';
      state.verbsLoaded = true;
    }
    render();
  }

  function goToConjugateSetup() {
    state.screen = 'conjugate-setup';
    if (state.verbsLoaded) {
      render();
    } else {
      loadVerbsFile();
    }
  }

  function backToConjugateSetup() {
    state.screen = 'conjugate-setup';
    render();
  }

  function prepareConjugateQuestion() {
    clearAutoAdvanceTimer();
    state.conjugateSelectedOption = null;
    state.conjugateLastWasTypo = false;
    const combo = state.conjugateQuestions[state.conjugateIndex];
    if (state.progress.settings.answerMode === 'choice' && combo) {
      const correctText = conjugatePresent(combo.pair.es, combo.person);
      const distractors = getConjugateDistractors(combo, correctText, 2);
      state.conjugateCurrentOptions = distractors.length >= 2 ? shuffle([correctText, ...distractors]) : null;
    } else {
      state.conjugateCurrentOptions = null;
    }
  }

  function startConjugateRound() {
    const settings = state.progress.settings;
    const roundLen = settings.roundLength === 'all' ? state.verbPairs.length : parseInt(settings.roundLength, 10);
    state.conjugateQuestions = buildConjugateRound(roundLen);
    state.conjugateIndex = 0;
    state.conjugateResults = [];
    state.conjugateInput = '';
    state.conjugateChecked = false;
    state.conjugateNewBestStreak = false;
    state.lastFlippedIndex = -1;
    state.screen = 'conjugate';
    prepareConjugateQuestion();
    render();
  }

  function recordConjugateAnswer(combo, correct, userAnswerDisplay) {
    const correctText = conjugatePresent(combo.pair.es, combo.person);
    state.conjugateWasCorrect = correct;
    state.conjugateChecked = true;
    state.conjugateResults.push({
      prompt: combo.pair.es + ' (' + PERSON_LABELS[combo.person] + ')',
      correctAnswer: correctText,
      userAnswer: userAnswerDisplay,
      correct,
    });

    const key = verbComboKey(combo.pair, combo.person);
    if (!state.progress.verbStats[key]) {
      state.progress.verbStats[key] = { box: 0, nextDue: 0, right: 0, wrong: 0, lastSeen: 0 };
    }
    const vs = state.progress.verbStats[key];
    const now = Date.now();
    vs.lastSeen = now;
    vs.es = combo.pair.es;
    vs.en = combo.pair.en;
    vs.person = combo.person;
    if (correct) {
      vs.right += 1;
      vs.box = Math.min((vs.box || 0) + 1, SRS_INTERVALS_DAYS.length - 1);
      vs.nextDue = now + SRS_INTERVALS_DAYS[vs.box] * 86400000;
      state.progress.conjugateStreak.current += 1;
      if (state.progress.conjugateStreak.current > state.progress.conjugateStreak.best) {
        state.progress.conjugateStreak.best = state.progress.conjugateStreak.current;
        state.conjugateNewBestStreak = true;
      }
    } else {
      vs.wrong += 1;
      vs.box = 0;
      vs.nextDue = now;
      state.progress.conjugateStreak.current = 0;
    }
    state.progress.conjugateLifetime.totalAnswered += 1;
    if (correct) state.progress.conjugateLifetime.totalCorrect += 1;
    markDailyActivity();
    saveProgress();

    if (correct) playCorrectSound(); else playWrongSound();
    if (state.progress.conjugateStreak.current >= 5) unlockAchievement('conjugateStreak5');
    if (state.progress.conjugateStreak.current >= 15) unlockAchievement('conjugateStreak15');
    if (state.progress.conjugateStreak.current >= 30) unlockAchievement('conjugateStreak30');
    if (state.progress.conjugateStreak.current >= 50) unlockAchievement('conjugateStreak50');
    if (state.progress.conjugateLifetime.totalCorrect >= 50) unlockAchievement('conjugateCorrect50');
    if (state.progress.conjugateLifetime.totalCorrect >= 200) unlockAchievement('conjugateCorrect200');
  }

  function submitConjugateAnswer() {
    const combo = state.conjugateQuestions[state.conjugateIndex];
    if (!combo || state.conjugateChecked) return;
    const correctText = conjugatePresent(combo.pair.es, combo.person);
    const userNorm = normalize(state.conjugateInput);
    const correctNorm = normalize(correctText);
    let correct = false;
    let wasTypo = false;
    if (userNorm.length > 0) {
      if (userNorm === correctNorm) {
        correct = true;
      } else if (isCloseMatch(userNorm, correctNorm)) {
        correct = true;
        wasTypo = true;
      }
    }
    state.conjugateLastWasTypo = wasTypo;
    recordConjugateAnswer(combo, correct, state.conjugateInput);
    render();
  }

  function selectConjugateOption(optionText) {
    const combo = state.conjugateQuestions[state.conjugateIndex];
    if (!combo || state.conjugateChecked) return;
    const correctText = conjugatePresent(combo.pair.es, combo.person);
    const correct = normalize(optionText) === normalize(correctText);
    state.conjugateSelectedOption = optionText;
    recordConjugateAnswer(combo, correct, optionText);
    render();
    const delay = correct ? 750 : 3000;
    // Timer-driven, no tap behind it - wrap so nextConjugateQuestion's
    // eventual showCelebration() call (on the round's last question) gets
    // replaceState() instead of an untrusted pushState(). Also safe for the
    // ordinary mid-round branch (render() straight back to 'conjugate'):
    // that screen is a BACK_QUIT_HANDLERS entry, not a normal navigable
    // screen, so hardware back on it always triggers the quit-confirm
    // regardless of how many (or how few) history entries were pushed
    // while working through the round - replaceState() there is harmless,
    // just avoids growing the stack once per question for no benefit.
    state.autoAdvanceTimer = setTimeout(() => { runAsTimerAdvance(nextConjugateQuestion); }, delay);
  }

  function evaluateConjugateRoundAchievements() {
    const score = state.conjugateResults.filter(r => r.correct).length;
    const total = state.conjugateResults.length;
    unlockAchievement('conjugateFirstRound');
    if (total > 0 && score === total) unlockAchievement('conjugatePerfect');
    if (state.conjugateQuestions.length >= 50) unlockAchievement('conjugateBigRound');
  }

  function nextConjugateQuestion() {
    clearAutoAdvanceTimer();
    if (state.conjugateIndex + 1 >= state.conjugateQuestions.length) {
      const score = state.conjugateResults.filter(r => r.correct).length;
      const total = state.conjugateResults.length;
      const perfect = total > 0 && score === total;
      suppressAchievementFX = true;
      evaluateConjugateRoundAchievements();
      suppressAchievementFX = false;
      showCelebration(perfect ? 'perfect' : 'finished', 'conjugate-result');
      return;
    }
    state.conjugateIndex += 1;
    state.conjugateInput = '';
    state.conjugateChecked = false;
    prepareConjugateQuestion();
    render();
  }

  function quitConjugateRound() {
    if (!confirm('Quit this round? Your progress on it will be scored as-is.')) return;
    clearAutoAdvanceTimer();
    state.screen = 'conjugate-result';
    evaluateConjugateRoundAchievements();
    render();
  }

  // Same idea for verb combos. The person index can always be recovered
  // from the stats key itself (normalize(es) + '::' + personIndex), so
  // only the display text needs the fallback.
  function lowestBoxVerbCombos(limit) {
    const fallbackByEs = {};
    state.verbPairs.forEach(pair => { fallbackByEs[normalize(pair.es)] = pair; });

    const sorted = Object.entries(state.progress.verbStats)
      .sort((a, b) => (a[1].box - b[1].box) || (b[1].wrong - a[1].wrong) || (a[1].lastSeen - b[1].lastSeen));

    const out = [];
    for (const [key, vs] of sorted) {
      const parts = key.split('::');
      const person = typeof vs.person === 'number' ? vs.person : parseInt(parts[1], 10);
      const fb = fallbackByEs[parts[0]];
      const es = vs.es || (fb && fb.es);
      const en = vs.en || (fb && fb.en) || '';
      if (es && !isNaN(person)) {
        out.push({ es, en, box: vs.box, wrong: vs.wrong, person });
        if (out.length >= limit) break;
      }
    }
    return out;
  }
