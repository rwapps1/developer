// Time Attack mode rules and flow.


  function backToTimeAttackSetup() {
    state.screen = 'timeattack-setup';
    render();
  }

  function clearTaTimerInterval() {
    if (state.taTimerHandle) {
      clearInterval(state.taTimerHandle);
      state.taTimerHandle = null;
    }
  }

  function clearTaFlashTimer() {
    if (state.taFlashTimer) {
      clearTimeout(state.taFlashTimer);
      state.taFlashTimer = null;
    }
  }

  function checkTimeAttackAchievements() {
    if (state.taScore >= 10) unlockAchievement('timeAttack10');
    if (state.taScore >= 25) unlockAchievement('timeAttack25');
    if (state.taScore >= 50) unlockAchievement('timeAttack50');
    if (state.taScore >= 100) unlockAchievement('timeAttack100');
    if (state.taStreak >= 15) unlockAchievement('timeAttackStreak15');
    if (state.taStreak >= 30) unlockAchievement('timeAttackStreak30');
    if (state.progress.taLifetime.totalCorrect >= 100) unlockAchievement('timeAttackCorrect100');
    if (state.progress.taLifetime.totalCorrect >= 500) unlockAchievement('timeAttackCorrect500');
  }

  function loadNextTimeAttackQuestion() {
    const settings = state.progress.settings;
    const prevKey = state.taCurrentQuestion ? wordKey(state.taCurrentQuestion) : null;
    const picked = weightedPickOne(state.mainPool, getWeight, prevKey);
    const direction = settings.direction === 'mixed' ? (Math.random() < 0.5 ? 'es-en' : 'en-es') : settings.direction;
    const current = { ...picked, direction };
    state.taCurrentQuestion = current;
    state.taSelectedOption = null;
    state.taInput = '';
    if (state.effectiveAnswerMode === 'choice') {
      const targetField = direction === 'es-en' ? current.en : current.es;
      const correctText = splitAnswers(targetField)[0];
      const distractors = getDistractors(current, correctText, 2);
      state.taCurrentOptions = distractors.length >= 2 ? shuffle([correctText, ...distractors]) : null;
    } else {
      state.taCurrentOptions = null;
    }
  }

  function startTimeAttack() {
    if (state.mainPool.length === 0) return;
    const settings = state.progress.settings;
    state.results = [];
    state.taScore = 0;
    state.taStreak = 0;
    state.taActive = true;
    state.taIsNewBest = false;
    state.taEndTime = Date.now() + 60000;
    state.taTimeLeft = 60;
    state.resultMode = 'timeattack';
    state.effectiveAnswerMode = (settings.answerMode === 'choice' && state.mainPool.length >= 3) ? 'choice' : 'type';
    loadNextTimeAttackQuestion();
    state.screen = 'timeattack';
    render();
    clearTaTimerInterval();
    state.taTimerHandle = setInterval(tickTimeAttack, 250);
  }

  function tickTimeAttack() {
    if (!state.taActive) return;
    const remainingMs = Math.max(0, state.taEndTime - Date.now());
    state.taTimeLeft = Math.ceil(remainingMs / 1000);
    const timerLabel = document.getElementById('ta-timer');
    if (timerLabel) timerLabel.textContent = state.taTimeLeft + 's';
    const fill = document.getElementById('ta-timer-fill');
    if (fill) fill.style.width = (remainingMs / 60000 * 100) + '%';
    if (remainingMs <= 0) {
      // Timer expiry, not a tap - wrap so showCelebration's own render()
      // and the eventual Celebrate -> Result auto-advance both get
      // history.replaceState() instead of an untrusted pushState(). See
      // runAsTimerAdvance in navigation.js.
      runAsTimerAdvance(endTimeAttack);
    }
  }

  function taSubmit(correct, displayValue) {
    if (!state.taActive) return;
    const current = state.taCurrentQuestion;
    // Update before recordAnswer() so its saveProgress() call persists
    // these alongside everything else in one write, rather than needing
    // a second save here.
    state.progress.taLifetime.totalAnswered += 1;
    if (correct) state.progress.taLifetime.totalCorrect += 1;
    recordAnswer(current, correct, displayValue);
    if (correct) {
      state.taScore++;
      state.taStreak++;
      checkTimeAttackAchievements();
    } else {
      state.taStreak = 0;
    }
    const scoreEl = document.getElementById('ta-score');
    if (scoreEl) scoreEl.textContent = state.taScore;
    const promptEl = document.getElementById('ta-prompt-card');
    if (promptEl) promptEl.classList.add(correct ? 'flash-correct' : 'flash-wrong');

    clearTaFlashTimer();
    const delay = correct ? 220 : 420;
    state.taFlashTimer = setTimeout(() => {
      if (!state.taActive) return;
      loadNextTimeAttackQuestion();
      render();
    }, delay);
  }

  function handleTaTypedSubmit() {
    if (!state.taActive) return;
    const current = state.taCurrentQuestion;
    const targetField = current.direction === 'es-en' ? current.en : current.es;
    const correct = isAnswerCorrect(state.taInput, targetField);
    taSubmit(correct, state.taInput);
  }

  function taSelectOption(optionText) {
    if (!state.taActive) return;
    const current = state.taCurrentQuestion;
    const targetField = current.direction === 'es-en' ? current.en : current.es;
    const acceptable = splitAnswers(targetField).map(normalize);
    const correct = acceptable.includes(normalize(optionText));
    taSubmit(correct, optionText);
  }

  function endTimeAttack() {
    if (!state.taActive) return;
    state.taActive = false;
    clearTaTimerInterval();
    clearTaFlashTimer();
    const prevBest = state.progress.timeAttackBest || 0;
    const isNewBest = state.taScore > prevBest;
    if (isNewBest) {
      state.progress.timeAttackBest = state.taScore;
    }
    saveProgress();
    state.taIsNewBest = isNewBest;
    state.resultMode = 'timeattack';
    // Perfect here means no wrong answers in the round, however many were
    // answered in the time — same score === total definition as the other
    // modes, just without a fixed round length.
    const score = state.results.filter(r => r.correct).length;
    const total = state.results.length;
    const perfect = total > 0 && score === total;
    suppressAchievementFX = true;
    // Same "not first-ever" guard as Memory Match's perfect redefinition —
    // prevBest > 0 means there was an actual previous best to beat.
    if (isNewBest && prevBest > 0) unlockAchievement('timeAttackNewBest');
    if (perfect) unlockAchievement('timeAttackFlawless');
    suppressAchievementFX = false;
    showCelebration(perfect ? 'perfect' : 'finished', 'result');
  }

  function quitTimeAttack() {
    if (!confirm('Quit this round? Your progress on it will be scored as-is.')) return;
    endTimeAttack();
  }
