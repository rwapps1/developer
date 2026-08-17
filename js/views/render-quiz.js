// Renders Quiz/Sentences/Categories setup and play screens, the shared
// Celebrate/Stream-checkpoint/Level-up screens, and the round results screen.


  function renderQuizSetup() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;

    const directionOptions = [['mixed', 'Mixed'], ['es-en', 'ES → EN'], ['en-es', 'EN → ES']];
    const lengthOptions = [['10', '10'], ['20', '20'], ['50', '50'], ['all', 'All']];
    const answerModeOptions = [['type', 'Type it'], ['choice', 'Multi']];

    const directionHtml = directionOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.direction === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');
    const lengthHtml = lengthOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.roundLength === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');
    const answerModeHtml = answerModeOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.answerMode === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="game-icon-badge" style="background:rgba(255,107,74,0.2);">🔤</div>
            <h1 style="font-size:30px; margin-bottom:24px;">Quiz</h1>
            <div class="card" style="width:100%;">
              <div class="segmented" id="direction-group">${directionHtml}</div>
              <div class="segmented" id="length-group" style="margin-top:14px;">${lengthHtml}</div>
              <div class="segmented" id="answermode-group" style="margin-top:14px;">${answerModeHtml}</div>
              <button id="start-btn" class="btn-primary" style="margin-top:22px;" ${state.mainPool.length === 0 ? 'disabled' : ''}>Start Quiz</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'game-modes'; render(); });
    document.getElementById('start-btn').addEventListener('click', startQuiz);

    document.querySelectorAll('#direction-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.progress.settings.direction = btn.dataset.val;
        saveProgress();
        render();
      });
    });
    document.querySelectorAll('#length-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.progress.settings.roundLength = btn.dataset.val;
        saveProgress();
        render();
      });
    });
    document.querySelectorAll('#answermode-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.progress.settings.answerMode = btn.dataset.val;
        saveProgress();
        render();
      });
    });
  }

  // Sentences mode setup - deliberately only has a round-length picker.
  // Direction and answer-mode settings don't apply to cloze: it's always
  // Spanish-target (see targetFieldFor) and always typed, never multiple
  // choice (a deliberate design decision - see the cloze feature notes).
  function renderSentencesSetup() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const sentenceCount = sentencePairs().length;

    const lengthOptions = [['10', '10'], ['20', '20'], ['50', '50'], ['all', 'All']];
    const lengthHtml = lengthOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.roundLength === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="game-icon-badge" style="background:rgba(201,168,255,0.2);">📝</div>
            <h1 style="font-size:30px; margin-bottom:8px;">Sentences</h1>
            <p class="sub" style="margin-bottom:24px;">Fill in the blank, ${sentenceCount} words with sentences</p>
            <div class="card" style="width:100%;">
              <div class="segmented" id="length-group">${lengthHtml}</div>
              <button id="start-btn" class="btn-primary" style="margin-top:22px;" ${sentenceCount === 0 ? 'disabled' : ''}>Start Sentences</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'game-modes'; render(); });
    document.getElementById('start-btn').addEventListener('click', startSentences);

    document.querySelectorAll('#length-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.progress.settings.roundLength = btn.dataset.val;
        saveProgress();
        render();
      });
    });
  }

  function renderCategories() {
    const app = document.getElementById('app');

    const tilesHtml = CATEGORIES.map(cat => `
      <button class="game-tile" data-cat="${cat.id}">
        <div class="tile-icon-wrap" style="background:rgba(255,107,74,0.18);">${cat.icon}</div>
        <div class="tile-name">${esc(cat.name)}</div>
        <div class="tile-meta">Vocabulary</div>
      </button>
    `).join('');

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
            <div class="screen-title">🏷️ Categories</div>
          </div>
          <div class="game-grid">${tilesHtml}</div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'game-modes'; render(); });
    document.querySelectorAll('.game-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        loadCategoryFile(tile.dataset.cat);
      });
    });
  }

  function renderCategorySetup() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const cat = CATEGORIES.find(c => c.id === state.activeCategory);
    const catName = cat ? cat.name : 'Category';
    const catIcon = cat ? cat.icon : '🏷️';

    let bodyHtml;
    if (state.categoryLoading) {
      bodyHtml = `<div class="status-line" style="justify-content:center;"><div class="spinner"></div> Loading ${esc(catName)}…</div>`;
    } else if (state.categoryError) {
      bodyHtml = `<div class="msg-error">${esc(state.categoryError)}</div>`;
    } else {
      const directionOptions = [['mixed', 'Mixed'], ['es-en', 'ES → EN'], ['en-es', 'EN → ES']];
      const lengthOptions = [['10', '10'], ['20', '20'], ['all', 'All']];
      const answerModeOptions = [['type', 'Type it'], ['choice', 'Multi']];

      const directionHtml = directionOptions.map(([val, label]) =>
        `<button class="seg-btn ${settings.direction === val ? 'active' : ''}" data-val="${val}">${label}</button>`
      ).join('');
      const lengthHtml = lengthOptions.map(([val, label]) =>
        `<button class="seg-btn ${settings.roundLength === val ? 'active' : ''}" data-val="${val}">${label}</button>`
      ).join('');
      const answerModeHtml = answerModeOptions.map(([val, label]) =>
        `<button class="seg-btn ${settings.answerMode === val ? 'active' : ''}" data-val="${val}">${label}</button>`
      ).join('');

      bodyHtml = `
        <div class="segmented" id="direction-group">${directionHtml}</div>
        <div class="segmented" id="length-group" style="margin-top:14px;">${lengthHtml}</div>
        <div class="segmented" id="answermode-group" style="margin-top:14px;">${answerModeHtml}</div>
        <button id="start-btn" class="btn-primary" style="margin-top:22px;" ${state.categoryPairs.length === 0 ? 'disabled' : ''}>Start Quiz</button>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="game-icon-badge" style="background:rgba(255,107,74,0.2);">${catIcon}</div>
            <h1 style="font-size:30px; margin-bottom:24px;">${esc(catName)}</h1>
            <div class="card" style="width:100%;">
              ${bodyHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', goToCategories);

    if (!state.categoryLoading && !state.categoryError) {
      document.getElementById('start-btn').addEventListener('click', startQuiz);
      document.querySelectorAll('#direction-group .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.progress.settings.direction = btn.dataset.val;
          saveProgress();
          render();
        });
      });
      document.querySelectorAll('#length-group .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.progress.settings.roundLength = btn.dataset.val;
          saveProgress();
          render();
        });
      });
      document.querySelectorAll('#answermode-group .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.progress.settings.answerMode = btn.dataset.val;
          saveProgress();
          render();
        });
      });
    }
  }

  function renderQuiz() {
    const app = document.getElementById('app');
    const current = state.questions[state.index];
    if (!current) return;

    const isAudioFormat = state.isStreamRound && current.format === 'audio';

    let tilesHtml = '';
    if (state.isStreamRound) {
      // Shows progress within the current 10-question checkpoint block,
      // not the whole (continuously-extended) questions array.
      const recentResults = state.results.slice(state.results.length - state.streamCheckpointCount);
      for (let i = 0; i < STREAM_CHECKPOINT_SIZE; i++) {
        let bg = 'var(--outline)';
        if (i < recentResults.length) bg = recentResults[i].correct ? COLORS.green : COLORS.red;
        else if (i === recentResults.length) bg = COLORS.ochre;
        tilesHtml += `<div class="tile" style="background:${bg}"></div>`;
      }
    } else {
      state.questions.forEach((_, i) => {
        let bg = 'var(--outline)';
        if (i < state.results.length) bg = state.results[i].correct ? COLORS.green : COLORS.red;
        else if (i === state.index) bg = COLORS.ochre;
        tilesHtml += `<div class="tile" style="background:${bg}"></div>`;
      });
    }

    const clozeBlank = current.format === 'cloze' ? findClozeBlank(current) : null;
    const clozeFallback = current.format === 'cloze' && !clozeBlank;
    // Read the context aloud, not the answer — the whole point of cloze is
    // guessing the missing word, so speaking current.sentence verbatim
    // (which still contains it) would just hand it over. "..." gives
    // TTS engines a natural pause where the word would go.
    const promptWord = (current.format === 'cloze' && clozeBlank) ? `${clozeBlank.before} ... ${clozeBlank.after}`.replace(/\s+/g, ' ').trim()
      : clozeFallback ? primaryText(current.en)
      : primaryText(current.direction === 'es-en' ? current.es : current.en);
    const answerWord = current.format === 'cloze' ? primaryText(current.es) : primaryText(current.direction === 'es-en' ? current.en : current.es);
    const promptLang = (current.format === 'cloze' && clozeBlank) ? 'es-ES'
      : clozeFallback ? 'en-US'
      : (current.direction === 'es-en' ? 'es-ES' : 'en-US');
    const answerLang = current.format === 'cloze' ? 'es-ES' : (current.direction === 'es-en' ? 'en-US' : 'es-ES');
    // The Note column disambiguates the English gloss specifically - only
    // relevant wherever English text is what's being shown, whether that's
    // the prompt (EN→ES) or the reveal (ES→EN, wrong or typo-forgiven).
    // Cloze never shows it - the prompt is a Spanish sentence, not a gloss.
    const promptNote = (current.format !== 'cloze' && current.direction !== 'es-en') ? (current.note || '') : '';
    const answerNote = (current.format !== 'cloze' && current.direction === 'es-en') ? (current.note || '') : '';

    // Stream decides choice-vs-type per question; every other mode still
    // uses the single round-level answerMode setting. Cloze is always
    // typed - a word bank would just hand back the ambiguity problem the
    // format exists to avoid (see the sentence-writing discussion).
    const useChoice = state.isStreamRound
      ? (current.format !== 'type' && current.format !== 'cloze' && state.currentOptions)
      : (state.effectiveAnswerMode === 'choice' && state.currentOptions);
    const shouldFlip = state.lastFlippedIndex !== state.index;
    if (shouldFlip) state.lastFlippedIndex = state.index;

    // results.length already counts the just-answered question once
    // checked is true (recordAnswer pushed it before this render), so the
    // +1 only belongs while the question is still unanswered — otherwise
    // the feedback screen for question 10 briefly claims to be question 11.
    const streamQuestionNum = state.results.length + (state.checked ? 0 : 1);
    const progressLabel = state.isStreamRound
      ? `Question ${streamQuestionNum} · ${isAudioFormat ? 'LISTEN' : (current.format === 'cloze' && clozeBlank ? 'FILL IN THE BLANK' : (current.direction === 'es-en' ? 'ES → EN' : 'EN → ES'))}`
      : `${state.index + 1} / ${state.questions.length} · ${(current.format === 'cloze' && clozeBlank) ? 'FILL IN THE BLANK' : (current.direction === 'es-en' ? 'ES → EN' : 'EN → ES')}`;

    const orbHtml = state.isStreamRound
      ? `<div class="glow-orb-progress streak-orb"><div class="orb-num">🔥${state.progress.streak.current}</div><div class="orb-lbl">STREAK</div></div>`
      : `<div class="glow-orb-progress"><div class="orb-num">${state.index + 1}</div><div class="orb-lbl">OF ${state.questions.length}</div></div>`;

    // One instruction line, computed once here so every mode that shares
    // this screen (Quiz, Daily Double, Categories, Stream) gets it for
    // free rather than needing separate wiring per mode. Audio format
    // already has its own hint ("Listen, then choose...") below, so it's
    // skipped here to avoid saying the same thing twice.
    const instructionText = isAudioFormat ? '' : (current.format === 'cloze' && clozeBlank) ? 'Type the missing word'
      : clozeFallback ? 'Type the word in Spanish'
      : useChoice
      ? (current.direction === 'es-en' ? 'What does this mean?' : 'How do you say this in Spanish?')
      : (current.direction === 'es-en' ? 'Type the English translation' : 'Type the word in Spanish');

    // Audio format hides the written word entirely — listening is the
    // exercise — and always speaks it (see the autoSpeak binding below),
    // regardless of the user's own "speak words aloud" setting. Cloze
    // shows the sentence with the target word blanked instead of a single
    // big prompt word; if the blank couldn't be found (shouldn't happen —
    // buildStreamBatch already checks — but a defensive fallback matters
    // more than a broken screen) it just renders like a normal typed
    // question instead.
    const promptRowHtml = isAudioFormat
      ? `<button id="speak-prompt-btn" class="speak-btn big" title="Hear it">🔊</button><div class="audio-hint">Listen, then choose the meaning</div>`
      : (current.format === 'cloze' && clozeBlank)
      ? `<div class="audio-hint" style="margin-bottom:10px;">${instructionText}</div><div class="cloze-sentence">${esc(clozeBlank.before)}<span class="cloze-blank">____</span>${esc(clozeBlank.after)}</div><div class="prompt-row" style="margin-top:10px;"><button id="speak-prompt-btn" class="speak-btn" title="Hear it">🔊</button><button id="hint-btn" class="hint-btn" title="Hear the full sentence">Hint</button></div>`
      : `<div class="audio-hint" style="margin-bottom:10px;">${instructionText}</div><div class="prompt-row"><div class="prompt-word">${esc(promptWord)}</div><button id="speak-prompt-btn" class="speak-btn" title="Hear it">🔊</button></div>${promptNote ? `<div class="prompt-note">${esc(promptNote)}</div>` : ''}`;

    let bottomHtml;

    if (useChoice) {
      const acceptable = splitAnswers(current.direction === 'es-en' ? current.en : current.es).map(normalize);
      let optionsHtml = '<div class="option-list" id="options-container">';
      state.currentOptions.forEach((opt) => {
        let cls = 'option-btn';
        if (state.checked) {
          const isCorrectOpt = acceptable.includes(normalize(opt));
          if (isCorrectOpt) cls += ' correct-choice pop-anim';
          else if (opt === state.selectedOption) cls += ' wrong-choice shake-anim';
        }
        optionsHtml += `<button class="${cls}" ${state.checked ? 'disabled' : ''}>${esc(opt)}</button>`;
      });
      optionsHtml += '</div>';

      let feedbackHtml = '';
      if (state.checked) {
        if (state.wasCorrect) {
          feedbackHtml = `<div class="feedback correct"><div class="title">✅ Correct</div></div>`;
        } else {
          feedbackHtml = `
            <div class="feedback wrong"><div class="title">❌ Not quite</div></div>
            <button id="next-btn" class="btn-primary">Next word</button>
            <div class="countdown-bar-track"><div class="countdown-bar-fill" id="countdown-fill"></div></div>
          `;
        }
      }
      bottomHtml = optionsHtml + feedbackHtml;
    } else if (!state.checked) {
      bottomHtml = `
        <input id="answer-input" type="text" placeholder="Type the translation…" value="${esc(state.input)}" autocomplete="off" />
        <button id="check-btn" class="btn-primary">Check</button>
      `;
    } else if (state.wasCorrect) {
      // Matches choice mode's correct state: no button, auto-advance only
      // (see submitAnswer). A near-miss now also shows the correct
      // spelling, not just "close enough" — you were forgiven, but you
      // should still see the right answer.
      bottomHtml = `
        <div class="feedback correct">
          <div class="title">✅ Correct</div>
          ${state.lastWasTypo ? `<div class="answer">✓ Close enough — small typo forgiven. Correct spelling: <strong>${esc(answerWord)}</strong>${answerNote ? ` (${esc(answerNote)})` : ''} <button id="speak-answer-btn" class="speak-btn" title="Hear it" style="width:26px;height:26px;font-size:12px;">🔊</button></div>` : ''}
        </div>
      `;
    } else {
      bottomHtml = `
        <div class="feedback wrong">
          <div class="title">❌ Not quite</div>
          <div class="answer">Correct answer: <strong>${esc(answerWord)}</strong>${answerNote ? ` (${esc(answerNote)})` : ''} <button id="speak-answer-btn" class="speak-btn" title="Hear it" style="width:26px;height:26px;font-size:12px;">🔊</button></div>
        </div>
        <button id="next-btn" class="btn-primary">${state.index + 1 >= state.questions.length ? 'See results' : 'Next word'}</button>
        <div class="countdown-bar-track"><div class="countdown-bar-fill" id="countdown-fill"></div></div>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap">
          <div class="tiles" style="grid-template-columns: repeat(${state.isStreamRound ? STREAM_CHECKPOINT_SIZE : Math.min(state.questions.length, 20)}, 1fr);">${tilesHtml}</div>
          <div class="progress-label">${progressLabel}</div>
          <div class="prompt-card ${shouldFlip ? 'card-flip-in' : ''}">
            ${orbHtml}
            ${promptRowHtml}
          </div>
          ${bottomHtml}
          <button id="quiz-quit-btn" class="quit-link" style="display:block; text-align:center; width:100%; margin-top:14px;">Quit</button>
        </div>
      </div>
    `;

    const speakPromptBtn = document.getElementById('speak-prompt-btn');
    speakPromptBtn.addEventListener('click', () => speak(promptWord, promptLang, speakPromptBtn));
    const hintBtn = document.getElementById('hint-btn');
    // Using this doesn't affect scoring, streaks, or SRS progress in any
    // way - hearing the word and still being able to type it correctly is
    // treated exactly like any other correct answer (deliberate decision;
    // most players are expected to only reach for it when needed).
    if (hintBtn) hintBtn.addEventListener('click', () => speak(current.sentence, 'es-ES', hintBtn));
    const shouldAutoSpeak = isAudioFormat || state.progress.settings.autoSpeak;

    if (useChoice) {
      if (!state.checked) {
        document.querySelectorAll('#options-container .option-btn').forEach((btn, i) => {
          btn.addEventListener('click', () => selectOption(state.currentOptions[i]));
        });
        if (shouldAutoSpeak) speak(promptWord, promptLang, speakPromptBtn);
      } else if (!state.wasCorrect) {
        document.getElementById('next-btn').addEventListener('click', nextQuestion);
        const fill = document.getElementById('countdown-fill');
        if (fill) {
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
        }
      }
    } else if (!state.checked) {
      const input = document.getElementById('answer-input');
      input.focus();
      input.addEventListener('input', (e) => { state.input = e.target.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          submitAnswer();
        }
      });
      document.getElementById('check-btn').addEventListener('click', submitAnswer);
      if (shouldAutoSpeak) speak(promptWord, promptLang, speakPromptBtn);
    } else if (!state.wasCorrect) {
      document.getElementById('next-btn').addEventListener('click', nextQuestion);
      const speakAnswerBtn = document.getElementById('speak-answer-btn');
      if (speakAnswerBtn) speakAnswerBtn.addEventListener('click', () => speak(answerWord, answerLang, speakAnswerBtn));
      const fill = document.getElementById('countdown-fill');
      if (fill) {
        requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
      }
    } else {
      // typed correct (possibly a forgiven near-miss) — no Next button,
      // matches choice mode's silent auto-advance-only correct state.
      const speakAnswerBtn = document.getElementById('speak-answer-btn');
      if (speakAnswerBtn) speakAnswerBtn.addEventListener('click', () => speak(answerWord, answerLang, speakAnswerBtn));
    }

    document.getElementById('quiz-quit-btn').addEventListener('click', quitQuiz);
  }

  // Brief celebratory interstitial shown between a round ending and its
  // results screen. Two variants (perfect / finished) shared across every
  // game mode; the background glow is picked from whichever results screen
  // it's about to hand off to, so it reads as a continuation, not a detour.
  function renderCelebrate() {
    const app = document.getElementById('app');
    const isPerfect = state.celebrateVariant === 'perfect';

    let bgClass = 'bg-quiz';
    if (state.celebrateNext === 'memory-result') bgClass = 'bg-memory';
    else if (state.celebrateNext === 'conjugate-result') bgClass = 'bg-conjugate';
    else if (state.celebrateNext === 'result') bgClass = state.resultMode === 'timeattack' ? 'bg-timeattack' : 'bg-quiz';

    app.innerHTML = `
      <div class="screen ${bgClass} celebrate-screen" id="celebrate-screen-el">
        <div class="celebrate-wrap">
          <div class="celebrate-badge-ring ${isPerfect ? 'perfect' : ''}">
            <div class="celebrate-badge-disc">${isPerfect ? '💯' : '🙌'}</div>
          </div>
          <div class="celebrate-headline ${isPerfect ? 'perfect' : 'finished'}">${isPerfect ? '¡Perfecto!' : '¡Ronda completa!'}</div>
          <p class="celebrate-subline">${isPerfect ? 'Not a single mistake.' : 'Round complete.'}</p>
        </div>
        <div class="tap-hint">Tap to continue</div>
      </div>
    `;
    document.getElementById('celebrate-screen-el').addEventListener('click', advanceFromCelebration);

    if (isPerfect) {
      launchConfetti();
      playPerfectFanfare();
    } else {
      playFinishedChime();
    }
  }

  // Every 10 Stream questions — a soft checkpoint, not a hard stop. Same
  // visual family as Celebrate (badge/headline/subline) but a genuine
  // two-way choice instead of a single tap-anywhere-to-continue, since
  // "keep going" and "stop" lead somewhere different here.
  function renderStreamCheckpoint() {
    const app = document.getElementById('app');
    const recentResults = state.results.slice(state.results.length - STREAM_CHECKPOINT_SIZE);
    const correctInBlock = recentResults.filter(r => r.correct).length;

    app.innerHTML = `
      <div class="screen bg-quiz stream-checkpoint-screen">
        <div class="celebrate-wrap">
          <div class="celebrate-badge-ring">
            <div class="celebrate-badge-disc">🔥</div>
          </div>
          <div class="celebrate-headline finished">${correctInBlock}/${STREAM_CHECKPOINT_SIZE} in a row!</div>
          <p class="celebrate-subline">Keep going, or stop here for now.</p>
          <div class="checkpoint-actions">
            <button id="stream-continue-btn" class="btn-primary">Keep going →</button>
            <button id="stream-stop-btn" class="link-btn">Stop for today</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('stream-continue-btn').addEventListener('click', continueStream);
    document.getElementById('stream-stop-btn').addEventListener('click', stopStream);
  }

  // Shown once, right after a results screen is left, if a level-up
  // happened at any point during that round (see leaveResults() /
  // checkLevelUp()). Uses a fixed gold theme rather than picking up
  // whichever game just finished — this is a meta-milestone spanning all
  // four games, not a per-game moment the way Celebrate is.
  function renderLevelUp() {
    const app = document.getElementById('app');
    const level = getXPLevel(state.progress).level;

    app.innerHTML = `
      <div class="screen bg-achievements levelup-screen" id="levelup-screen-el">
        <div class="levelup-wrap">
          <div class="levelup-ring-outer">
            <div class="levelup-disc">
              <div class="levelup-disc-inner"><span class="levelup-num">${level}</span></div>
            </div>
          </div>
          <h1 class="levelup-headline">Level Up!</h1>
          <p class="levelup-subline">You reached Level ${level}</p>
        </div>
        <div class="tap-hint">Tap to continue</div>
      </div>
    `;
    document.getElementById('levelup-screen-el').addEventListener('click', advanceFromLevelUp);
    playLevelUpFanfare();
  }

  function renderResult() {
    const app = document.getElementById('app');
    const score = state.results.filter(r => r.correct).length;
    const total = state.results.length;
    const missed = state.results.filter(r => !r.correct);
    const streak = state.progress.streak;

    let mosaicHtml = '';
    state.results.forEach(r => {
      mosaicHtml += `<div class="sq" style="background:${r.correct ? COLORS.green : COLORS.red}"></div>`;
    });

    let reviewHtml = '';
    if (missed.length > 0) {
      let itemsHtml = '';
      missed.forEach(r => {
        itemsHtml += `
          <div class="review-item">
            <span class="from">${esc(r.prompt)}</span> → <span class="to">${esc(r.correctAnswer)}</span>
            ${r.userAnswer ? `<div class="yours">You wrote: ${esc(r.userAnswer)}</div>` : ''}
          </div>
        `;
      });
      reviewHtml = `
        <div class="card" style="margin-bottom:20px;">
          <div class="review-title">Words to review</div>
          ${itemsHtml}
        </div>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="eyebrow" style="margin-bottom:4px;">Resultado</div>
            <div class="score-big" style="margin-bottom:12px;">${score}/${total}</div>
            ${state.newBestThisRound ? `<div class="new-best">🔥 New best streak: ${streak.best}</div>` : ''}
            <div class="streak-line">Current streak: ${streak.current} &nbsp;·&nbsp; Best: ${streak.best}</div>
            <div class="mosaic">${mosaicHtml}</div>
            ${reviewHtml}
            <button id="again-btn" class="btn-primary" style="width:100%; margin-bottom:10px;">Play again</button>
            ${state.lastRoundWasStream ? '' : `<button id="settings-btn" class="btn-secondary" style="width:100%;">Change settings</button>`}
          </div>
        </div>
      </div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => leaveResults(goHome));
    document.getElementById('again-btn').addEventListener('click', () => leaveResults(
      state.lastRoundWasStream ? startStream : (state.lastRoundWasSentences ? startSentences : startQuiz)
    ));
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => leaveResults(
      state.lastRoundWasSentences ? backToSentencesSetup : backToQuizSetup
    ));
  }
