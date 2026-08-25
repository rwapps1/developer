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
  //
  // Callers matter here: this function itself is sometimes invoked from a
  // real user gesture (e.g. quitQuiz's on-screen Quit button) and sometimes
  // from a timer with no gesture behind it at all (Time Attack's countdown
  // hitting zero inside tickTimeAttack's setInterval; Memory Match's
  // post-match setTimeout; Conjugate's auto-advance setTimeout). The
  // render() below - entering 'celebrate' - inherits whichever context its
  // caller is running in. If that context is untrusted (inTimerAdvance is
  // already true because we're inside one of those setTimeout/setInterval
  // callbacks), this render() must not push a fresh trusted-looking entry
  // either - so it's wrapped the same way, rather than assuming the caller
  // was always a tap the way the original Quiz-only version did.
  function showCelebration(variant, nextScreen) {
    clearCelebrateTimer();
    state.celebrateVariant = variant;
    state.celebrateNext = nextScreen;
    state.screen = 'celebrate';
    runAsTimerAdvance(render);
    pingActivity();
    const hold = variant === 'perfect' ? 2700 : 2200;
    // Wrapped in runAsTimerAdvance (navigation.js) so the render() this
    // triggers gets history.replaceState() instead of pushState() - this
    // fires with no tap behind it, and an untrusted pushState() here is
    // what caused the confirmed results-screen back-button bug (Celebrate
    // -> Result both landed via this same auto-advance path; the browser
    // silently skipped the untrusted entry on the next real back press).
    state.celebrateTimer = setTimeout(() => runAsTimerAdvance(advanceFromCelebration), hold);
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
    // Wrapped in runAsTimerAdvance (navigation.js) - see the matching
    // comment on showCelebration's setTimeout above; same untrusted-
    // pushState risk applies to this auto-continue path.
    state.celebrateTimer = setTimeout(() => runAsTimerAdvance(continueStream), 4500);
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

    // True/False: always pairs the fixed Spanish word with either its own
    // correct translation or a distractor's (50/50), regardless of the
    // (irrelevant here) current.direction that buildStreamBatch still
    // assigns to every question. getDistractors() itself picks its
    // candidate field based on current.direction, so it's called with a
    // forced 'es-en' override here rather than trusting the random one -
    // otherwise a question randomly assigned 'en-es' would hand back
    // Spanish distractors for what's meant to be an English claim.
    if (current && current.format === 'truefalse') {
      const correctText = splitAnswers(current.en)[0];
      const isTrue = Math.random() < 0.5;
      if (isTrue) {
        state.tfClaimEn = correctText;
        state.tfIsTrue = true;
      } else {
        const distractors = getDistractors({ ...current, direction: 'es-en' }, correctText, 1);
        if (distractors.length >= 1) {
          state.tfClaimEn = distractors[0];
          state.tfIsTrue = false;
        } else {
          // Word list too small to find a distinct distractor - show a
          // true claim instead of a broken/empty one.
          state.tfClaimEn = correctText;
          state.tfIsTrue = true;
        }
      }
      state.currentOptions = null;
      return;
    }

    // Sentence Scramble: tokenize on whitespace only, so punctuation stays
    // attached to whichever word it follows - this sidesteps the
    // punctuation/case-insensitivity question entirely, since correctness
    // is checked structurally (placed order vs. original token order), not
    // by comparing text. Defensive fallback to 'type' mirrors cloze's own
    // pattern, though buildStreamBatch already filters on findClozeBlank()
    // so this shouldn't normally trigger.
    if (current && current.format === 'scramble') {
      const tokens = (current.sentence || '').split(/\s+/).filter(Boolean);
      if (tokens.length < 2) {
        current.format = 'type';
        state.currentOptions = null;
        return;
      }
      state.scrambleBank = shuffle(tokens.map((text, origIndex) => ({ text, origIndex })));
      state.scramblePlaced = [];
      state.currentOptions = null;
      return;
    }

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
    const isTrueFalse = current.format === 'truefalse';
    const isScramble = current.format === 'scramble';
    // targetFieldFor() isn't meaningful for True/False (there's no single
    // right "translation" - the whole question IS a translation, being
    // judged true or false), so it's skipped for that format rather than
    // called and then ignored.
    const targetField = isTrueFalse ? null : targetFieldFor(current);
    state.wasCorrect = correct;
    state.checked = true;
    state.results.push({
      prompt: current.format === 'cloze' ? primaryText(current.es)
        : isTrueFalse ? `${primaryText(current.es)} = ${state.tfClaimEn}`
        : isScramble ? '(sentence order)'
        : primaryText(current.direction === 'es-en' ? current.es : current.en),
      correctAnswer: isTrueFalse ? (state.tfIsTrue ? 'True' : 'False')
        : isScramble ? current.sentence
        : primaryText(targetField),
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
      // True/False and Scramble mini-streak achievements: consecutive
      // correct answers within that specific format only. A wrong answer
      // in a different format doesn't touch these counters - only a wrong
      // answer in the SAME format resets them.
      if (current.format === 'truefalse') {
        state.tfSessionStreak = correct ? state.tfSessionStreak + 1 : 0;
        if (state.tfSessionStreak >= 10) unlockAchievement('streamTrueFalseStreak10');
      }
      if (current.format === 'scramble') {
        state.scrambleSessionStreak = correct ? state.scrambleSessionStreak + 1 : 0;
        if (state.scrambleSessionStreak >= 10) unlockAchievement('streamScrambleStreak10');
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
    // Computed and stored BEFORE render() — render() is what builds the
    // countdown bar and reads state.autoAdvanceDelay to set its animation
    // duration, so this has to already be the current question's value by
    // the time that happens. Doing this after render() left the bar
    // animating on the previous question's (usually shorter) delay for
    // one question every time, then sitting empty until the real,
    // longer timeout actually fired.
    const isCloze = current.format === 'cloze';
    const delay = isCloze
      ? (!correct ? 6000 : (wasTypo ? 4000 : 3000))
      : (!correct ? 3000 : (wasTypo ? 1800 : 750));
    state.autoAdvanceDelay = delay;
    recordAnswer(current, correct, state.input);
    render();
    // A forgiven typo has a full sentence plus the correct spelling to
    // read (see the near-miss feedback in renderQuiz) — a plain correct
    // answer's 750ms is too quick for that, but it's not as much to
    // absorb as a wrong answer's full "correct answer: X" breakdown either.
    // Cloze questions get noticeably longer on every outcome — there's a
    // full sentence + English translation to read on top of the usual
    // feedback, and a manual "Next word" button covers anyone who reads
    // faster than that (see renderQuiz's cloze-only Next button).
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

  // True/False: standard MC-style timing (750ms correct / 3000ms wrong).
  // Only the target word's box moves - the distractor (when shown in a
  // False claim) is never passed to recordAnswer at all, so it's
  // structurally impossible for its SRS progress to be touched here.
  function selectTrueFalse(answerIsTrue) {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    const correct = answerIsTrue === state.tfIsTrue;
    state.selectedOption = answerIsTrue ? 'True' : 'False';
    // 1200ms rather than the usual 750ms "correct" speed used elsewhere -
    // this is the only place in the app a countdown bar is shown on a
    // correct answer at all (everywhere else, correct = silent auto-advance,
    // no bar), and 750ms reads as an instant flash rather than a visible
    // drain. The longer window also gives the auto-advance timer itself
    // more margin.
    const delay = correct ? 1200 : 3000;
    state.autoAdvanceDelay = delay; // set before render() — see submitAnswer's comment on why the ordering matters
    recordAnswer(current, correct, answerIsTrue ? 'True' : 'False');
    render();
    state.autoAdvanceTimer = setTimeout(() => { nextQuestion(); }, delay);
  }

  // Sentence Scramble: tap-to-place. Tapping a bank word appends it to
  // scramblePlaced; once every word has been placed, it auto-submits -
  // same "acting on the last input completes the question" pattern as
  // choice mode's selectOption.
  function scramblePlaceTile(origIndex) {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    if (state.scramblePlaced.includes(origIndex)) return;
    state.scramblePlaced.push(origIndex);
    if (state.scramblePlaced.length === state.scrambleBank.length) {
      submitScramble();
    } else {
      render();
    }
  }

  // Tapping a placed pill in the strip sends it back to the bank -
  // correction interaction, alongside the clear-all button below.
  function scrambleRemoveTile(origIndex) {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    state.scramblePlaced = state.scramblePlaced.filter(i => i !== origIndex);
    render();
  }

  function scrambleClearAll() {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    state.scramblePlaced = [];
    render();
  }

  // Correct = placed order exactly matches original sentence-token order
  // (index 0, 1, 2, ...) - a structural check, not a text comparison, so
  // it's unaffected by punctuation/capitalization and immune to ambiguity
  // from repeated words in the sentence. Cloze-style extended auto-advance
  // timing (see submitAnswer's comment) since there's a full sentence +
  // translation to read on the reveal either way.
  function submitScramble() {
    const current = state.questions[state.index];
    if (!current || state.checked) return;
    // Correctness is judged by the WORD placed at each position, not by
    // which physical tile it came from. When a sentence contains the same
    // word twice (e.g. two "mi"), the two tiles are interchangeable - a
    // player who places the "other" identical tile in a slot has still
    // produced the correct sentence, so comparing tile origIndex to
    // position would wrongly reject them. The original word at position i
    // is the bank tile whose origIndex === i (origIndex was assigned in
    // original token order in prepareQuestion), so we compare texts.
    const originalTextAt = (pos) => {
      const tile = state.scrambleBank.find(t => t.origIndex === pos);
      return tile ? tile.text : '';
    };
    const placedTextAt = (pos) => {
      const tile = state.scrambleBank.find(t => t.origIndex === state.scramblePlaced[pos]);
      return tile ? tile.text : '';
    };
    const correct = state.scramblePlaced.length === state.scrambleBank.length
      && state.scramblePlaced.every((_, i) => placedTextAt(i) === originalTextAt(i));
    const userAnswerDisplay = state.scramblePlaced
      .map(i => (state.scrambleBank.find(t => t.origIndex === i) || {}).text || '')
      .join(' ');
    const delay = correct ? 3000 : 6000;
    state.autoAdvanceDelay = delay;
    recordAnswer(current, correct, userAnswerDisplay);
    render();
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
          buildStreamBatch(activePairs(), 20, lastKey)
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
      // Wrapped in runAsTimerAdvance (navigation.js) - same untrusted-
      // pushState risk as the Celebrate/checkpoint auto-advances above.
      // advanceFromLevelUp calls a destination fn (goHome/startQuiz/etc.)
      // that itself calls render(), so the flag has to be active for the
      // whole call, not just a single render() - runAsTimerAdvance covers
      // that since it wraps the entire function call, not just one line.
      state.levelUpTimer = setTimeout(() => runAsTimerAdvance(advanceFromLevelUp), 3200);
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

  // ---- Quit-confirm overlay (shared across all 4 game modes) ------------
  // Replaces window.confirm() for the "quit this round?" prompt. A native
  // confirm() is a browser/OS-level modal outside the app's own DOM and
  // history state - a hardware back press while it's open is handled by
  // the WebView/browser chrome itself, not by this app's popstate listener,
  // so no amount of history-stack logic in navigation.js could ever
  // reliably catch it. That's what was causing the confirmed "quit,
  // cancel, quit again" bug: the second confirm() open/dismiss cycle could
  // fall through to exiting the app instead of being caught as a normal
  // back press. Modelling the dialog as an ordinary in-app state
  // (state.quitConfirmMode + a render()ed overlay) fixes this structurally
  // - it becomes just another screen transition, so it participates in
  // exactly the same trusted-gesture pushState/replaceState handling as
  // every other screen instead of being an opaque native dialog navigation
  // can't see into.
  //
  // Each mode's own quit*() function (quitQuiz/quitTimeAttack/
  // quitMemoryMatch/quitConjugateRound) is now just a thin call into
  // showQuitConfirm(mode) - the actual "what does quitting THIS mode do"
  // logic lives in QUIT_ACTIONS below, run only once the user taps Quit on
  // the overlay.
  const QUIT_MESSAGES = {
    quiz: () => state.isStreamRound
      ? 'Stop here? Your progress so far will be saved.'
      : 'Quit this round? Your progress on it will be scored as-is.',
    timeattack: () => 'Quit this round? Your progress on it will be scored as-is.',
    'memory-play': () => 'Quit this board? Your progress on it will be lost.',
    conjugate: () => 'Quit this round? Your progress on it will be scored as-is.',
  };

  const QUIT_ACTIONS = {
    quiz: () => {
      clearAutoAdvanceTimer();
      state.lastRoundWasStream = state.isStreamRound;
      state.isStreamRound = false;
      state.screen = 'result';
      evaluateRoundAchievements();
    },
    timeattack: () => {
      endTimeAttack();
    },
    'memory-play': () => {
      clearMemoryTimerInterval();
      clearMemoryFlipTimer();
      goHome();
    },
    conjugate: () => {
      clearAutoAdvanceTimer();
      state.screen = 'conjugate-result';
      evaluateConjugateRoundAchievements();
    },
  };

  // Called by each mode's Quit button/back-button handler. If the overlay
  // for a DIFFERENT mode were somehow already open this would just replace
  // it - not expected to happen in practice since only one play screen is
  // ever active at a time, but guarding state.quitConfirmMode to the
  // current screen keeps it self-correcting either way.
  function showQuitConfirm(mode) {
    state.quitConfirmMode = mode;
    render();
  }

  // Cancel: overlay closes, nothing else changes. Called by the overlay's
  // own Cancel button, and by navigation.js when a hardware back press
  // lands while the overlay is already open (same as tapping Cancel).
  function cancelQuitConfirm() {
    state.quitConfirmMode = null;
    render();
  }

  // Confirm: run the mode's real quit logic, then close the overlay. The
  // mode-specific action is responsible for setting state.screen to
  // wherever quitting that mode actually goes (results screen, or straight
  // home for Memory Match) - this just sequences "run it, then clear the
  // overlay flag" so a stray re-render never shows the overlay again on
  // the destination screen.
  function confirmQuitCurrentMode() {
    const mode = state.quitConfirmMode;
    state.quitConfirmMode = null;
    const action = QUIT_ACTIONS[mode];
    if (action) action();
    render();
  }

  // Thin per-mode entry points - unchanged names/call sites everywhere else
  // in the codebase (render-quiz.js's Quit button, navigation.js's
  // BACK_QUIT_HANDLERS) so this file is the only one that needed to change
  // shape; every existing caller just triggers the overlay now instead of
  // a native dialog.
  function quitQuiz() {
    showQuitConfirm('quiz');
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
    state.streamFormatBag = []; // fresh shuffle bag for this session - see buildStreamBatch
    state.streamRecentWordKeys = []; // fresh recent-word window for this session - see buildStreamBatch
    state.questions = buildStreamBatch(pool, 20, null);
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
    state.tfSessionStreak = 0;
    state.scrambleSessionStreak = 0;
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
