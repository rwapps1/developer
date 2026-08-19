// Quiz/Sentences/Stream/Daily Double rules and flow: question prep, answer
// recording, celebration/checkpoint handling, and the Categories feature.


  function clearAutoAdvanceTimer() {
    if (state.autoAdvanceTimer) {
      clearTimeout(state.autoAdvanceTimer);
      state.autoAdvanceTimer = null;
    }
  }

  function clearCelebrateTimer() {
    if (state.celebrateTimer) {
      clearTimeout(state.celebrateTimer);
      state.celebrateTimer = null;
    }
  }

  // Shows the round-end celebration screen, then automatically continues
  // to nextScreen after a short hold (or immediately on tap — see the
  // click listener in renderCelebrate).
  function showCelebration(variant, nextScreen) {
    clearCelebrateTimer();
    state.celebrateVariant = variant;
    state.celebrateNext = nextScreen;
    state.screen = 'celebrate';
    render();
    pingActivity();
    const hold = variant === 'perfect' ? 2700 : 2200;
    state.celebrateTimer = setTimeout(advanceFromCelebration, hold);
  }

  function advanceFromCelebration() {
    clearCelebrateTimer();
    const next = state.celebrateNext;
    state.celebrateNext = null;
    state.celebrateVariant = null;
    state.screen = next;
    render();
    flushQueuedAchievementToasts();
  }

  // Every 10 Stream questions: a soft checkpoint, not a hard stop. Reuses
  // the celebrate visuals but offers a real choice instead of a single
  // tap-anywhere-to-continue, since "keep going" and "stop" lead somewhere
  // genuinely different here (stopping shows results; continuing doesn't).
  function showStreamCheckpoint() {
    clearCelebrateTimer();

    const recentResults = state.results.slice(state.results.length - STREAM_CHECKPOINT_SIZE);
    const perfectBlock = recentResults.length === STREAM_CHECKPOINT_SIZE && recentResults.every(r => r.correct);
    state.progress.streamLifetime.checkpointsCompleted += 1;
    state.streamSessionCheckpoints += 1;
    if (state.progress.streamLifetime.checkpointsCompleted === 1) unlockAchievement('streamFirst');
    if (state.progress.streamLifetime.checkpointsCompleted >= 10) unlockAchievement('streamCheckpoints10');
    if (state.progress.streamLifetime.checkpointsCompleted >= 50) unlockAchievement('streamCheckpoints50');
    if (perfectBlock) unlockAchievement('streamPerfectCheckpoint');
    if (state.streamSessionCheckpoints >= 5) unlockAchievement('streamMarathon');
    saveProgress();

    state.screen = 'stream-checkpoint';
    render();
    pingActivity();
    // Longer than a normal round-end Celebrate hold (2200ms) on purpose —
    // there's a real decision here (keep going or stop), not just a
    // glance, so it needs actual reading + deciding time.
    state.celebrateTimer = setTimeout(continueStream, 4500);
  }

  function continueStream() {
    clearCelebrateTimer();
    state.streamCheckpointCount = 0;
    state.index += 1;
    state.input = '';
    state.checked = false;
    prepareQuestion();
    state.screen = 'quiz';
    render();
  }

  function stopStream() {
    clearCelebrateTimer();
    const score = state.results.filter(r => r.correct).length;
    const total = state.results.length;
    const perfect = total > 0 && score === total;
    state.lastRoundWasStream = true;
    state.isStreamRound = false;
    suppressAchievementFX = true;
    evaluateRoundAchievements();
    suppressAchievementFX = false;
    showCelebration(perfect ? 'perfect' : 'finished', 'result');
  }

  function prepareQuestion() {
    clearAutoAdvanceTimer();
    state.selectedOption = null;
    state.lastWasTypo = false;
    const current = state.questions[state.index];
    // Stream decides choice-vs-type per question (current.format); every
    // other mode still uses the single round-level answerMode setting.
    const useChoiceMode = state.isStreamRound
      ? (current && current.format !== 'type' && current.format !== 'cloze')
      : (state.effectiveAnswerMode === 'choice');
    if (useChoiceMode && current) {
      const targetField = current.direction === 'es-en' ? current.en : current.es;
      const correctText = splitAnswers(targetField)[0];
      const distractors = getDistractors(current, correctText, 2);
      state.currentOptions = distractors.length >= 2 ? shuffle([correctText, ...distractors]) : null;
    } else {
      state.currentOptions = null;
    }
  }

  function startQuiz() {
    const settings = state.progress.settings;
    const pool = activePairs();
    const roundLen = settings.roundLength === 'all' ? pool.length : parseInt(settings.roundLength, 10);
    state.questions = buildRound(pool, roundLen, settings.direction);
    state.index = 0;
    state.results = [];
    state.input = '';
    state.checked = false;
    state.newBestThisRound = false;
    state.lastFlippedIndex = -1;
    state.resultMode = 'round';
    state.lastRoundWasStream = false;
    state.lastRoundWasSentences = false;
    state.effectiveAnswerMode = (settings.answerMode === 'choice' && pool.length >= 3) ? 'choice' : 'type';
    prepareQuestion();
    state.screen = 'quiz';
    render();
  }

  // Sentences mode - every question is cloze, drawn only from words that
  // have a sentence (see sentencePairs()). Reuses the exact same round
  // engine, renderer, submit/record/next-question flow, and results screen
  // as Quiz - direction and answerMode settings don't apply to cloze (see
  // targetFieldFor / renderQuiz), so this mode has neither. Round length is
  // the one setting it does share with every other mode.
  function startSentences() {
    const settings = state.progress.settings;
    const pool = sentencePairs();
    const roundLen = settings.roundLength === 'all' ? pool.length : Math.min(parseInt(settings.roundLength, 10), pool.length);
    state.questions = buildRound(pool, roundLen, 'es-en').map(q => ({ ...q, format: 'cloze' }));
    state.index = 0;
    state.results = [];
    state.input = '';
    state.checked = false;
    state.newBestThisRound = false;
    state.lastFlippedIndex = -1;
    state.resultMode = 'round';
    state.lastRoundWasStream = false;
    state.lastRoundWasSentences = true;
    state.activeCategory = null; // Sentences draws from the whole word list, never a category
    state.effectiveAnswerMode = 'type'; // cloze is always typed, never multiple choice
    prepareQuestion();
    state.screen = 'quiz';
    render();
  }

  function backToSentencesSetup() {
    state.screen = 'sentences-setup';
    render();
  }

  function recordAnswer(current, correct, userAnswerDisplay) {
    const targetField = targetFieldFor(current);
    state.wasCorrect = correct;
    state.checked = true;
    state.results.push({
      prompt: current.format === 'cloze' ? primaryText(current.es) : primaryText(current.direction === 'es-en' ? current.es : current.en),
      correctAnswer: primaryText(targetField),
      userAnswer: userAnswerDisplay,
      correct,
    });

    const key = wordKey(current);
    if (!state.progress.wordStats[key]) {
      state.progress.wordStats[key] = { box: 0, nextDue: 0, right: 0, wrong: 0, lastSeen: 0 };
    }
    const ws = state.progress.wordStats[key];
    const now = Date.now();
    ws.lastSeen = now;
    ws.es = primaryText(current.es);
    ws.en = primaryText(current.en);
    if (correct) {
      ws.right += 1;
      ws.box = Math.min((ws.box || 0) + 1, SRS_INTERVALS_DAYS.length - 1);
      ws.nextDue = now + SRS_INTERVALS_DAYS[ws.box] * 86400000;
      // Permanent flag: true the first time this word ever reaches box 6,
      // and never cleared again — even if the word later gets a wrong
      // answer and drops back down. masteredWordsCount must only ever go
      // up, or the achievement would feel like it's regressing through no
      // fault of the person playing.
      if (ws.box === SRS_INTERVALS_DAYS.length - 1 && !ws.masteredEver) {
        ws.masteredEver = true;
        state.progress.masteredWordsCount = (state.progress.masteredWordsCount || 0) + 1;
        if (state.progress.masteredWordsCount >= 25) unlockAchievement('masteredWords25');
        if (state.progress.masteredWordsCount >= 100) unlockAchievement('masteredWords100');
      }
      state.progress.streak.current += 1;
      if (state.progress.streak.current > state.progress.streak.best) {
        state.progress.streak.best = state.progress.streak.current;
        state.newBestThisRound = true;
      }
    } else {
      ws.wrong += 1;
      ws.box = 0;
      ws.nextDue = now; // due again straight away
      state.progress.streak.current = 0;
    }
    state.progress.lifetime.totalAnswered += 1;
    if (correct) state.progress.lifetime.totalCorrect += 1;
    markDailyActivity();
    saveProgress();

    if (correct) playCorrectSound(); else playWrongSound();
    if (state.progress.streak.current >= 10) unlockAchievement('streak10');
    if (state.progress.streak.current >= 25) unlockAchievement('streak25');
    if (state.progress.lifetime.totalCorrect >= 50) unlockAchievement('correct50');
    if (state.progress.lifetime.totalCorrect >= 200) unlockAchievement('correct200');

    // Stream-specific tracking. Kept separate from the shared counters
    // above (lifetime/streak) since those already blend across every mode
    // that calls recordAnswer — these need to be genuinely Stream-only to
    // mean what their achievements claim.
    if (state.isStreamRound) {
      state.progress.streamLifetime.totalAnswered += 1;
      if (correct) {
        state.progress.streamLifetime.totalCorrect += 1;
        state.streamSessionStreak += 1;
        if (current.format) state.streamFormatsCorrect[current.format] = true;
        if (current.format === 'audio') state.progress.streamLifetime.audioCorrect += 1;
      } else {
        state.streamSessionStreak = 0;
      }
      if (state.progress.streamLifetime.totalCorrect >= 100) unlockAchievement('streamCorrect100');
      if (state.progress.streamLifetime.totalCorrect >= 500) unlockAchievement('streamCorrect500');
      if (state.progress.streamLifetime.audioCorrect >= 25) unlockAchievement('streamAudio25');
      if (state.streamSessionStreak >= 40) unlockAchievement('streamStreak40');
      if (state.streamFormatsCorrect.mc && state.streamFormatsCorrect.audio && state.streamFormatsCorrect.type) {
        unlockAchievement('streamAllFormats');
      }
      if (state.streamFormatsCorrect.mc && state.streamFormatsCorrect.audio && state.streamFormatsCorrect.type && state.streamFormatsCorrect.cloze) {
        unlockAchievement('streamAllFormatsQuad');
      }
      saveProgress();
    }
  }

  function submitAnswer() {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    const targetField = targetFieldFor(current);
    const userNorm = normalize(state.input);
    const acceptable = splitAnswers(targetField).map(normalize);
    let correct = false;
    let wasTypo = false;
    if (userNorm.length > 0) {
      if (acceptable.includes(userNorm)) {
        correct = true;
      } else if (acceptable.some(ans => isCloseMatch(userNorm, ans))) {
        correct = true;
        wasTypo = true;
      }
    }
    state.lastWasTypo = wasTypo;
    recordAnswer(current, correct, state.input);
    render();
    // A forgiven typo has a full sentence plus the correct spelling to
    // read (see the near-miss feedback in renderQuiz) — a plain correct
    // answer's 750ms is too quick for that, but it's not as much to
    // absorb as a wrong answer's full "correct answer: X" breakdown either.
    const delay = !correct ? 3000 : (wasTypo ? 1800 : 750);
    state.autoAdvanceTimer = setTimeout(() => { nextQuestion(); }, delay);
  }

  function selectOption(optionText) {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    const targetField = current.direction === 'es-en' ? current.en : current.es;
    const acceptable = splitAnswers(targetField).map(normalize);
    const correct = acceptable.includes(normalize(optionText));
    state.selectedOption = optionText;
    recordAnswer(current, correct, optionText);
    render();
    const delay = correct ? 750 : 3000;
    state.autoAdvanceTimer = setTimeout(() => { nextQuestion(); }, delay);
  }

  function nextQuestion() {
    clearAutoAdvanceTimer();
    if (state.isStreamRound) {
      state.streamCheckpointCount += 1;
      // Keep the batch topped up well before it runs out, so it never
      // visibly "ends" — buildStreamBatch samples with replacement, so
      // this works regardless of how long the session has run.
      if (state.questions.length - (state.index + 1) < 5) {
        const lastKey = wordKey(state.questions[state.questions.length - 1]);
        state.questions = state.questions.concat(
          buildStreamBatch(activePairs(), 20, lastKey, state.questions.length)
        );
      }
      if (state.streamCheckpointCount >= STREAM_CHECKPOINT_SIZE) {
        showStreamCheckpoint();
        return;
      }
      state.index += 1;
      state.input = '';
      state.checked = false;
      prepareQuestion();
      render();
      return;
    }
    if (state.index + 1 >= state.questions.length) {
      const score = state.results.filter(r => r.correct).length;
      const total = state.results.length;
      const perfect = total > 0 && score === total;
      if (state.isDailyDoubleRound) {
        // Double XP: the round already earned its normal XP one correct
        // answer at a time via recordAnswer(), same as any other quiz.
        // This just matches that with one more top-up of the same size —
        // no per-answer special-casing needed.
        state.progress.dailyDoubleBonusXP = (state.progress.dailyDoubleBonusXP || 0) + score * XP_PER_QUIZ_CORRECT;
        state.isDailyDoubleRound = false;
        saveProgress();
      }
      suppressAchievementFX = true;
      evaluateRoundAchievements();
      suppressAchievementFX = false;
      showCelebration(perfect ? 'perfect' : 'finished', 'result');
      return;
    }
    state.index += 1;
    state.input = '';
    state.checked = false;
    prepareQuestion();
    render();
  }

  function goHome() {
    state.activeCategory = null;
    state.screen = 'start';
    render();
  }

  function clearLevelUpTimer() {
    if (state.levelUpTimer) {
      clearTimeout(state.levelUpTimer);
      state.levelUpTimer = null;
    }
  }

  // Every button that leaves a results screen (Home, Play again, Change
  // settings — all four games) routes through here instead of calling its
  // destination directly. If a level-up happened during that round, the
  // Level Up screen takes over first and the original destination is
  // deferred until it's dismissed (see advanceFromLevelUp below) — so the
  // celebration can never be missed regardless of which button was tapped.
  // Auto-advances after a short hold, same tap-to-skip-early pattern as
  // the round-end Celebrate screen.
  function leaveResults(destinationFn) {
    if (state.pendingLevelUp) {
      state.levelUpNextFn = destinationFn;
      state.pendingLevelUp = null;
      state.screen = 'level-up';
      render();
      pingActivity();
      clearLevelUpTimer();
      state.levelUpTimer = setTimeout(advanceFromLevelUp, 3200);
    } else {
      destinationFn();
    }
  }

  function advanceFromLevelUp() {
    clearLevelUpTimer();
    const fn = state.levelUpNextFn;
    state.levelUpNextFn = null;
    if (fn) fn(); else goHome();
  }

  function backToQuizSetup() {
    state.screen = state.activeCategory ? 'category-setup' : 'quiz-setup';
    render();
  }

  function goToCategories() {
    state.activeCategory = null;
    state.screen = 'categories';
    render();
  }

  function loadCategoryFile(categoryId) {
    state.activeCategory = categoryId;
    state.categoryLoading = false;
    // A 50-word round doesn't make sense for a themed category list -
    // fall back to a sane default rather than cycling through it repeatedly.
    if (state.progress.settings.roundLength === '50') {
      state.progress.settings.roundLength = '20';
      saveProgress();
    }
    const filtered = state.pairs.filter(p => pairHasCategory(p, categoryId));
    if (filtered.length === 0) {
      state.categoryError = 'No words tagged "' + categoryId + '" found. Check the Category column in words.xlsx.';
      state.categoryPairs = [];
    } else {
      state.categoryError = '';
      state.categoryPairs = filtered;
    }
    state.screen = 'category-setup';
    render();
  }

  function quitQuiz() {
    const msg = state.isStreamRound
      ? 'Stop here? Your progress so far will be saved.'
      : 'Quit this round? Your progress on it will be scored as-is.';
    if (!confirm(msg)) return;
    clearAutoAdvanceTimer();
    state.lastRoundWasStream = state.isStreamRound;
    state.isStreamRound = false;
    state.screen = 'result';
    evaluateRoundAchievements();
    render();
  }

  // The 10 words for a Daily Double round: your lowest-box words first
  // (combined Quiz + Categories history, same source as "Words to
  // review"), padded with random never-seen words if there aren't 10 yet.
  function buildDailyDoubleRound() {
    const selected = lowestBoxWords(10);
    const usedKeys = new Set(selected.map(w => wordKey(w)));

    if (selected.length < 10) {
      const neverSeen = shuffle(state.mainPool.filter(p => !state.progress.wordStats[wordKey(p)] && !usedKeys.has(wordKey(p))));
      for (const p of neverSeen) {
        if (selected.length >= 10) break;
        selected.push(p);
        usedKeys.add(wordKey(p));
      }
    }
    // Extreme edge case — a word list small enough that even never-seen
    // words run out. Top up with anything not already picked rather than
    // quietly running a shorter round.
    if (selected.length < 10) {
      const anyRemaining = shuffle(state.mainPool.filter(p => !usedKeys.has(wordKey(p))));
      for (const p of anyRemaining) {
        if (selected.length >= 10) break;
        selected.push(p);
        usedKeys.add(wordKey(p));
      }
    }

    return shuffle(selected).map(p => ({
      ...p,
      direction: Math.random() < 0.5 ? 'es-en' : 'en-es', // mixed, same as buildRound()
    }));
  }

  function startDailyDoubleQuiz() {
    state.activeCategory = null; // so distractors always draw from the main list
    state.questions = buildDailyDoubleRound();
    state.index = 0;
    state.results = [];
    state.input = '';
    state.checked = false;
    state.newBestThisRound = false;
    state.lastFlippedIndex = -1;
    state.resultMode = 'round';
    state.effectiveAnswerMode = 'choice'; // always multiple choice, regardless of the user's own saved setting
    state.isDailyDoubleRound = true;
    prepareQuestion();
    state.screen = 'quiz';
    render();
  }

  // Stream: a continuous, mixed-format round with no fixed length — built
  // as a Quiz variant the same way Daily Double is, so it inherits sound
  // effects, achievement checks, and the deferred Level Up screen for free
  // via the existing recordAnswer()/leaveResults() machinery, rather than
  // needing any of that rebuilt separately.
  function startStream() {
    state.activeCategory = null; // main pool only, same as Daily Double
    const pool = activePairs();
    state.questions = buildStreamBatch(pool, 20, null, 0);
    state.index = 0;
    state.results = [];
    state.input = '';
    state.checked = false;
    state.newBestThisRound = false;
    state.lastFlippedIndex = -1;
    state.resultMode = 'round';
    state.isDailyDoubleRound = false;
    state.isStreamRound = true;
    state.streamCheckpointCount = 0;
    state.streamSessionStreak = 0;
    state.streamSessionCheckpoints = 0;
    state.streamFormatsCorrect = {};
    prepareQuestion();
    state.screen = 'quiz';
    render();
  }

  function handleDailyDoublePlay() {
    state.progress.dailyDoubleLastHandled = todayDateString();
    saveProgress();
    startDailyDoubleQuiz();
  }

  function handleDailyDoubleSkip() {
    state.progress.dailyDoubleLastHandled = todayDateString();
    saveProgress();
    render();
  }
