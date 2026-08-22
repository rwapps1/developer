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
    // True/False speaks the fixed Spanish word; Scramble's "Hear it" plays
    // the full unblanked sentence - safe here (unlike cloze) since the
    // words are already visible in the bank, just unordered, so nothing is
    // being given away by hearing them in their real order.
    const promptWord = (current.format === 'cloze' && clozeBlank) ? `${clozeBlank.before} ... ${clozeBlank.after}`.replace(/\s+/g, ' ').trim()
      : current.format === 'truefalse' ? primaryText(current.es)
      : current.format === 'scramble' ? current.sentence
      : clozeFallback ? primaryText(current.en)
      : primaryText(current.direction === 'es-en' ? current.es : current.en);
    const answerWord = current.format === 'cloze' ? primaryText(current.es) : primaryText(current.direction === 'es-en' ? current.en : current.es);
    const promptLang = (current.format === 'cloze' && clozeBlank) ? 'es-ES'
      : (current.format === 'truefalse' || current.format === 'scramble') ? 'es-ES'
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

    // Centralized per-format label, used by both the Stream and non-Stream
    // progress-label variants below (truefalse/scramble are Stream-only
    // formats today, but this keeps the two label branches in sync either way).
    const formatLabel = (current.format === 'cloze' && clozeBlank) ? 'FILL IN THE BLANK'
      : current.format === 'truefalse' ? 'TRUE OR FALSE'
      : current.format === 'scramble' ? 'PLACE IN THE CORRECT ORDER'
      : (current.direction === 'es-en' ? 'ES → EN' : 'EN → ES');

    // results.length already counts the just-answered question once
    // checked is true (recordAnswer pushed it before this render), so the
    // +1 only belongs while the question is still unanswered — otherwise
    // the feedback screen for question 10 briefly claims to be question 11.
    const streamQuestionNum = state.results.length + (state.checked ? 0 : 1);
    const progressLabel = state.isStreamRound
      ? `Question ${streamQuestionNum} · ${isAudioFormat ? 'LISTEN' : formatLabel}`
      : `${state.index + 1} / ${state.questions.length} · ${formatLabel}`;

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

    // The sentence strip: placed words as filled, tappable pills (tap to
    // send back to the bank) and remaining slots as empty placeholders -
    // gives a sense of progress without revealing sentence length/structure
    // beyond word count. After a wrong answer, slots that landed in the
    // wrong position are highlighted so the mistake is visible at a glance.
    // MUST be computed before promptRowHtml below, which references it in
    // the scramble branch - a let can't be read before its declaration
    // (temporal dead zone), so declaring it later threw at render time.
    let scrambleStripHtml = '';
    if (current.format === 'scramble') {
      const totalSlots = state.scrambleBank.length;
      for (let i = 0; i < totalSlots; i++) {
        if (i < state.scramblePlaced.length) {
          const origIndex = state.scramblePlaced[i];
          const tile = state.scrambleBank.find(t => t.origIndex === origIndex);
          // Compare by word text, not tile index, so a correctly-placed
          // duplicate word (e.g. a second "mi") isn't flagged wrong just
          // because it came from the other identical tile - mirrors the
          // text-based correctness check in submitScramble.
          const originalTile = state.scrambleBank.find(t => t.origIndex === i);
          const originalText = originalTile ? originalTile.text : '';
          const wrongPos = state.checked && !state.wasCorrect && (tile ? tile.text : '') !== originalText;
          scrambleStripHtml += `<button class="scramble-slot filled ${state.checked ? '' : 'tappable'} ${wrongPos ? 'wrong-pos' : ''}" data-orig="${origIndex}" ${state.checked ? 'disabled' : ''}>${esc(tile ? tile.text : '')}</button>`;
        } else {
          scrambleStripHtml += `<div class="scramble-slot empty"></div>`;
        }
      }
    }

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
      : current.format === 'truefalse'
      ? `<div class="audio-hint" style="margin-bottom:10px;">Does this mean the same thing?</div><div class="tf-claim"><span class="tf-claim-es">${esc(primaryText(current.es))}</span><span class="tf-claim-eq">=</span><span class="tf-claim-en">${esc(state.tfClaimEn)}</span></div><div class="prompt-row" style="margin-top:10px; justify-content:center;"><button id="speak-prompt-btn" class="speak-btn" title="Hear it">🔊</button></div>`
      : current.format === 'scramble'
      ? `<div class="audio-hint" style="margin-bottom:10px;">Tap the words in the right order</div><div class="scramble-strip" id="scramble-strip">${scrambleStripHtml}</div><div class="prompt-row" style="margin-top:10px; justify-content:center;"><button id="speak-prompt-btn" class="speak-btn stacked-hint" title="Hear the sentence (hint)"><span class="hint-icon-glyph">🔊</span><span class="hint-icon-label">Hint</span></button>${(!state.checked && state.scramblePlaced.length > 0) ? '<button id="scramble-clear-btn" class="hint-btn" title="Clear all">Clear</button>' : ''}</div>`
      : `<div class="audio-hint" style="margin-bottom:10px;">${instructionText}</div><div class="prompt-row"><div class="prompt-word">${esc(promptWord)}</div><button id="speak-prompt-btn" class="speak-btn" title="Hear it">🔊</button></div>${promptNote ? `<div class="prompt-note">${esc(promptNote)}</div>` : ''}`;

    // Cloze answer reveal - the full sentence plus its English translation,
    // shown after every cloze answer (correct, wrong, or a forgiven near
    // miss) regardless of outcome. Only ever applies to cloze questions
    // with a resolvable blank and a translation actually on the sheet -
    // older/edited rows without one just don't show this line.
    const clozeRevealHtml = (current.format === 'cloze' && clozeBlank && current.sentenceTranslation)
      ? `<div class="cloze-reveal"><span class="cloze-reveal-es">${esc(current.sentence)}</span><span class="cloze-reveal-divider">—</span><span class="cloze-reveal-en">${esc(current.sentenceTranslation)}</span></div>`
      : '';

    // Same reveal treatment for Scramble - shown after every answer
    // (correct or wrong) so the sentence's meaning is visible either way,
    // not just when the order was wrong.
    const scrambleRevealHtml = (current.format === 'scramble' && current.sentenceTranslation)
      ? `<div class="cloze-reveal"><span class="cloze-reveal-es">${esc(current.sentence)}</span><span class="cloze-reveal-divider">—</span><span class="cloze-reveal-en">${esc(current.sentenceTranslation)}</span></div>`
      : '';

    let bottomHtml;

    if (current.format === 'truefalse') {
      let optionsHtml;
      if (!state.checked) {
        optionsHtml = `
          <div class="option-list" id="tf-options">
            <button class="option-btn" id="tf-true-btn">✅ True</button>
            <button class="option-btn" id="tf-false-btn">❌ False</button>
          </div>
        `;
      } else {
        optionsHtml = `
          <div class="option-list">
            <button class="option-btn ${state.tfIsTrue ? 'correct-choice pop-anim' : (state.selectedOption === 'True' ? 'wrong-choice shake-anim' : '')}" disabled>✅ True</button>
            <button class="option-btn ${!state.tfIsTrue ? 'correct-choice pop-anim' : (state.selectedOption === 'False' ? 'wrong-choice shake-anim' : '')}" disabled>❌ False</button>
          </div>
        `;
      }
      let feedbackHtml = '';
      if (state.checked) {
        // Both outcomes now get a manual escape hatch, not just wrong
        // answers - correct used to be auto-advance-only (matching old
        // MC/typed behavior), but that leaves no way to continue at all if
        // the scheduled timer ever gets throttled/paused (a known risk for
        // background JS timers in Android WebViews/TWAs). Scramble/cloze
        // already had this fallback; True/False didn't.
        feedbackHtml = state.wasCorrect
          ? `
            <div class="feedback correct"><div class="title">✅ Correct</div></div>
            <button id="next-btn" class="btn-primary">Next word</button>
            <div class="countdown-bar-track"><div class="countdown-bar-fill" id="countdown-fill"></div></div>
          `
          : `
            <div class="feedback wrong"><div class="title">❌ Not quite</div><div class="answer">This was ${state.tfIsTrue ? 'True' : 'False'}.</div></div>
            <button id="next-btn" class="btn-primary">Next word</button>
            <div class="countdown-bar-track"><div class="countdown-bar-fill" id="countdown-fill"></div></div>
          `;
      }
      bottomHtml = optionsHtml + feedbackHtml;
    } else if (current.format === 'scramble') {
      let bankHtml = '';
      if (!state.checked) {
        // Render every tile in state.scrambleBank's fixed shuffle-order
        // slot always, rather than filtering placed ones out of the array.
        // Filtering removed them from the flow entirely, so the remaining
        // flex-wrap pills reflowed and visibly jumped every time one was
        // placed. Placed tiles now stay put in the DOM as an invisible,
        // non-interactive placeholder that still occupies their original
        // space (see .scramble-pill.placed in quiz.css) - positions stay
        // static for the whole question, in or out of the bank.
        const bankTilesHtml = state.scrambleBank
          .map(t => {
            const isPlaced = state.scramblePlaced.includes(t.origIndex);
            return `<button class="scramble-pill${isPlaced ? ' placed' : ''}" data-orig="${t.origIndex}" ${isPlaced ? 'disabled' : ''}>${esc(t.text)}</button>`;
          })
          .join('');
        bankHtml = `<div class="scramble-bank" id="scramble-bank">${bankTilesHtml}</div>`;
      }
      let feedbackHtml = '';
      if (state.checked) {
        feedbackHtml = state.wasCorrect
          ? `<div class="feedback correct"><div class="title">✅ Correct order</div>${scrambleRevealHtml}</div>`
          : `<div class="feedback wrong"><div class="title">❌ Not quite the right order</div>${scrambleRevealHtml}</div>`;
        feedbackHtml += `<button id="next-btn" class="btn-primary">${state.index + 1 >= state.questions.length ? 'See results' : 'Next word'}</button><div class="countdown-bar-track"><div class="countdown-bar-fill" id="countdown-fill"></div></div>`;
      }
      bottomHtml = bankHtml + feedbackHtml;
    } else if (useChoice) {
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
          ${clozeRevealHtml}
        </div>
        ${current.format === 'cloze' ? `<button id="next-btn" class="btn-primary">${state.index + 1 >= state.questions.length ? 'See results' : 'Next word'}</button><div class="countdown-bar-track"><div class="countdown-bar-fill" id="countdown-fill"></div></div>` : ''}
      `;
    } else {
      bottomHtml = `
        <div class="feedback wrong">
          <div class="title">❌ Not quite</div>
          <div class="answer">Correct answer: <strong>${esc(answerWord)}</strong>${answerNote ? ` (${esc(answerNote)})` : ''} <button id="speak-answer-btn" class="speak-btn" title="Hear it" style="width:26px;height:26px;font-size:12px;">🔊</button></div>
          ${clozeRevealHtml}
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

    if (current.format === 'truefalse') {
      if (!state.checked) {
        document.getElementById('tf-true-btn').addEventListener('click', () => selectTrueFalse(true));
        document.getElementById('tf-false-btn').addEventListener('click', () => selectTrueFalse(false));
        if (shouldAutoSpeak) speak(promptWord, promptLang, speakPromptBtn);
      } else {
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
        const fill = document.getElementById('countdown-fill');
        if (fill) {
          fill.style.transitionDuration = (state.autoAdvanceDelay || (state.wasCorrect ? 1200 : 3000)) + 'ms';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
        }
      }
    } else if (current.format === 'scramble') {
      if (!state.checked) {
        document.querySelectorAll('#scramble-bank .scramble-pill').forEach(btn => {
          btn.addEventListener('click', () => scramblePlaceTile(parseInt(btn.dataset.orig, 10)));
        });
        document.querySelectorAll('#scramble-strip .scramble-slot.filled').forEach(btn => {
          btn.addEventListener('click', () => scrambleRemoveTile(parseInt(btn.dataset.orig, 10)));
        });
        const clearBtn = document.getElementById('scramble-clear-btn');
        if (clearBtn) clearBtn.addEventListener('click', scrambleClearAll);
        // Deliberately NO auto-speak for scramble: promptWord is the full
        // sentence (the answer), so auto-speaking would read it aloud on
        // load and again on every pill tap (each tap re-renders). The 🔊
        // button stays wired via the shared speakPromptBtn listener above,
        // so hearing the sentence is available only on explicit press,
        // as a hint.
      } else {
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
        const fill = document.getElementById('countdown-fill');
        if (fill) {
          fill.style.transitionDuration = (state.autoAdvanceDelay || 3000) + 'ms';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
        }
      }
    } else if (useChoice) {
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
        // Matches the actual auto-advance delay (see submitAnswer) rather
        // than assuming the CSS default 3s — cloze wrong answers now run
        // longer, so the bar needs to finish emptying at the same moment
        // the timer actually fires, not sooner.
        fill.style.transitionDuration = (state.autoAdvanceDelay || 3000) + 'ms';
        requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
      }
    } else {
      // typed correct (possibly a forgiven near-miss) — no Next button for
      // ordinary Quiz/Sentences words, matches choice mode's silent
      // auto-advance-only correct state. Cloze is the one exception (see
      // the bottomHtml above): its auto-advance runs several seconds
      // longer so there's time to read the sentence + translation, so it
      // gets a manual "Next word" + countdown bar the same as a wrong
      // answer, letting a fast reader skip ahead instead of waiting it out.
      const speakAnswerBtn = document.getElementById('speak-answer-btn');
      if (speakAnswerBtn) speakAnswerBtn.addEventListener('click', () => speak(answerWord, answerLang, speakAnswerBtn));
      if (current.format === 'cloze') {
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
        const fill = document.getElementById('countdown-fill');
        if (fill) {
          fill.style.transitionDuration = (state.autoAdvanceDelay || 3000) + 'ms';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
        }
      }
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

    // Round Complete gets small radiating "impact ticks" (like the clap
    // actually landing) since 🙌 is a hands-together gesture; Perfect
    // Round's 💯 doesn't have an equivalent motion to echo, so it skips them.
    const impactTicksHtml = !isPerfect ? `
      <svg class="impact-ticks" viewBox="0 0 100 100">
        <line x1="30" y1="14" x2="24" y2="3"></line>
        <line x1="42" y1="6" x2="40" y2="-6"></line>
        <line x1="55" y1="4" x2="55" y2="-9"></line>
        <line x1="68" y1="6" x2="70" y2="-6"></line>
        <line x1="80" y1="14" x2="86" y2="3"></line>
      </svg>
    ` : '';

    app.innerHTML = `
      <div class="screen ${bgClass} celebrate-screen" id="celebrate-screen-el">
        <div class="celebrate-wrap">
          <div class="celebrate-badge-ring ${isPerfect ? 'perfect' : ''}">
            <div class="badge-swirl swirl-a"></div>
            <div class="badge-swirl swirl-b"></div>
            ${impactTicksHtml}
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
            <button id="stream-stop-btn" class="link-btn">Take a Break</button>
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
    // This screen only fires when a level-up actually happened this round
    // (see checkLevelUp()), so level-1 is the level being left behind. If a
    // single round can ever jump more than one level, this still lands on
    // the right final number — only the ring's starting point would be off
    // by however many levels were skipped, which is a rare/cosmetic edge
    // case rather than a wrong result.
    const prevLevel = Math.max(1, level - 1);

    app.innerHTML = `
      <div class="screen bg-achievements levelup-screen" id="levelup-screen-el">
        <div class="levelup-wrap">
          <div class="levelup-ring-outer">
            <svg class="levelup-ring-svg" viewBox="0 0 148 148">
              <circle class="levelup-ring-fill" id="levelup-ring-fill" cx="74" cy="74" r="60"></circle>
            </svg>
            <div class="levelup-disc-inner"><span class="levelup-num" id="levelup-num">${prevLevel}</span></div>
          </div>
          <h1 class="levelup-headline">Level Up!</h1>
          <p class="levelup-subline">You reached Level ${level}</p>
        </div>
        <div class="tap-hint">Tap to continue</div>
      </div>
    `;
    document.getElementById('levelup-screen-el').addEventListener('click', advanceFromLevelUp);
    playLevelUpFanfare();
    animateLevelUpRing(level);
  }

  // Draws the level ring in clockwise from empty, flipping the number from
  // the old level to the new one right as it closes, instead of the ring
  // (and number) simply appearing pre-filled.
  function animateLevelUpRing(level) {
    const circle = document.getElementById('levelup-ring-fill');
    const numberEl = document.getElementById('levelup-num');
    if (!circle || !numberEl) return;
    const circumference = 2 * Math.PI * 60;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      circle.style.strokeDasharray = circumference;
      circle.style.strokeDashoffset = 0;
      numberEl.textContent = level;
      return;
    }

    circle.style.transition = 'none';
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference;
    void circle.getBoundingClientRect();
    circle.style.transition = 'stroke-dashoffset 1s cubic-bezier(.4,.1,.2,1)';
    circle.style.strokeDashoffset = 0;

    setTimeout(() => {
      numberEl.textContent = level;
      numberEl.classList.remove('flip');
      void numberEl.offsetWidth;
      numberEl.classList.add('flip');
    }, 900);
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
