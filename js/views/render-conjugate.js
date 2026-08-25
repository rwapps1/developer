// Renders Conjugate setup, play, and result screens.


  function renderConjugateSetup() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;

    let bodyHtml;
    if (state.verbsLoading) {
      bodyHtml = `<div class="status-line" style="justify-content:center;"><div class="spinner"></div> Loading verbs…</div>`;
    } else if (state.verbsError) {
      bodyHtml = `<div class="msg-error">${esc(state.verbsError)}</div>`;
    } else {
      const lengthOptions = [['10', '10'], ['20', '20'], ['50', '50'], ['all', 'All']];
      const answerModeOptions = [['type', 'Type it'], ['choice', 'Multi']];

      const lengthHtml = lengthOptions.map(([val, label]) =>
        `<button class="seg-btn ${settings.roundLength === val ? 'active' : ''}" data-val="${val}">${label}</button>`
      ).join('');
      const answerModeHtml = answerModeOptions.map(([val, label]) =>
        `<button class="seg-btn ${settings.answerMode === val ? 'active' : ''}" data-val="${val}">${label}</button>`
      ).join('');

      bodyHtml = `
        <div class="segmented" id="length-group">${lengthHtml}</div>
        <div class="segmented" id="answermode-group" style="margin-top:14px;">${answerModeHtml}</div>
        <button id="start-btn" class="btn-primary" style="margin-top:22px;" ${state.verbPairs.length === 0 ? 'disabled' : ''}>Start</button>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-conjugate">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="game-icon-badge" style="background:rgba(52,211,153,0.2);">📖</div>
            <h1 style="font-size:30px; margin-bottom:24px;">Conjugate</h1>
            <div class="card" style="width:100%;">
              ${bodyHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'game-modes'; render(); });

    if (!state.verbsLoading && !state.verbsError) {
      document.getElementById('start-btn').addEventListener('click', startConjugateRound);
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

  function renderConjugate() {
    const app = document.getElementById('app');
    const combo = state.conjugateQuestions[state.conjugateIndex];
    if (!combo) return;

    let tilesHtml = '';
    state.conjugateQuestions.forEach((_, i) => {
      let bg = 'var(--outline)';
      if (i < state.conjugateResults.length) bg = state.conjugateResults[i].correct ? COLORS.green : COLORS.red;
      else if (i === state.conjugateIndex) bg = COLORS.ochre;
      tilesHtml += `<div class="tile" style="background:${bg}"></div>`;
    });

    const promptWord = combo.pair.es;
    const personLabel = PERSON_LABELS[combo.person];
    const correctText = conjugatePresent(combo.pair.es, combo.person);
    const promptLang = 'es-ES';
    const verbTranslation = primaryText(combo.pair.en);

    const useChoice = state.progress.settings.answerMode === 'choice' && state.conjugateCurrentOptions;
    const shouldFlip = state.lastFlippedIndex !== state.conjugateIndex;
    if (shouldFlip) state.lastFlippedIndex = state.conjugateIndex;

    let bottomHtml;

    if (useChoice) {
      let optionsHtml = '<div class="option-list" id="options-container">';
      state.conjugateCurrentOptions.forEach((opt) => {
        let cls = 'option-btn';
        if (state.conjugateChecked) {
          const isCorrectOpt = normalize(opt) === normalize(correctText);
          if (isCorrectOpt) cls += ' correct-choice pop-anim';
          else if (opt === state.conjugateSelectedOption) cls += ' wrong-choice shake-anim';
        }
        optionsHtml += `<button class="${cls}" ${state.conjugateChecked ? 'disabled' : ''}>${esc(opt)}</button>`;
      });
      optionsHtml += '</div>';

      let feedbackHtml = '';
      if (state.conjugateChecked) {
        if (state.conjugateWasCorrect) {
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
    } else if (!state.conjugateChecked) {
      bottomHtml = `
        <input id="answer-input" type="text" placeholder="Type the conjugated form…" value="${esc(state.conjugateInput)}" autocomplete="off" />
        <button id="check-btn" class="btn-primary">Check</button>
      `;
    } else {
      bottomHtml = `
        <div class="feedback ${state.conjugateWasCorrect ? 'correct' : 'wrong'}">
          <div class="title">${state.conjugateWasCorrect ? '✅ Correct' : '❌ Not quite'}</div>
          ${!state.conjugateWasCorrect ? `<div class="answer">Correct answer: <strong>${esc(correctText)}</strong> <button id="speak-answer-btn" class="speak-btn" title="Hear it" style="width:26px;height:26px;font-size:12px;">🔊</button></div>` : ''}
          ${state.conjugateWasCorrect && state.conjugateLastWasTypo ? `<div class="answer">✓ Close enough — small typo forgiven</div>` : ''}
        </div>
        <button id="next-btn" class="btn-primary">${state.conjugateIndex + 1 >= state.conjugateQuestions.length ? 'See results' : 'Next word'}</button>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-conjugate">
        <div class="wrap">
          <div class="tiles" style="grid-template-columns: repeat(${Math.min(state.conjugateQuestions.length, 20)}, 1fr);">${tilesHtml}</div>
          <div class="progress-label">${state.conjugateIndex + 1} / ${state.conjugateQuestions.length}</div>
          <div class="prompt-card ${shouldFlip ? 'card-flip-in' : ''}">
            <div class="glow-orb-progress"><div class="orb-num">${state.conjugateIndex + 1}</div><div class="orb-lbl">OF ${state.conjugateQuestions.length}</div></div>
            <div class="eyebrow" style="margin-bottom:8px;">${esc(personLabel.toUpperCase())}</div>
            <div class="prompt-row">
              <div class="prompt-word">${esc(promptWord)}</div>
              <button id="speak-prompt-btn" class="speak-btn" title="Hear it">🔊</button>
            </div>
            <div class="prompt-translation">${esc(verbTranslation)}</div>
            ${combo.pair.note ? `<div class="prompt-note">${esc(combo.pair.note)}</div>` : ''}
          </div>
          ${bottomHtml}
          <button id="conjugate-quit-btn" class="quit-link" style="display:block; text-align:center; width:100%; margin-top:14px;">Quit</button>
        </div>
      </div>
    `;

    const speakPromptBtn = document.getElementById('speak-prompt-btn');
    speakPromptBtn.addEventListener('click', () => speak(promptWord, promptLang, speakPromptBtn));

    if (useChoice) {
      if (!state.conjugateChecked) {
        document.querySelectorAll('#options-container .option-btn').forEach((btn, i) => {
          btn.addEventListener('click', () => selectConjugateOption(state.conjugateCurrentOptions[i]));
        });
        if (state.progress.settings.autoSpeak) speak(promptWord, promptLang, speakPromptBtn);
      } else if (!state.conjugateWasCorrect) {
        document.getElementById('next-btn').addEventListener('click', nextConjugateQuestion);
        const fill = document.getElementById('countdown-fill');
        if (fill) {
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = '0%'; }); });
        }
      }
    } else if (!state.conjugateChecked) {
      const input = document.getElementById('answer-input');
      input.focus();
      input.addEventListener('input', (e) => { state.conjugateInput = e.target.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          submitConjugateAnswer();
        }
      });
      document.getElementById('check-btn').addEventListener('click', submitConjugateAnswer);
      if (state.progress.settings.autoSpeak) speak(promptWord, promptLang, speakPromptBtn);
    } else {
      document.getElementById('next-btn').addEventListener('click', nextConjugateQuestion);
      const speakAnswerBtn = document.getElementById('speak-answer-btn');
      if (speakAnswerBtn) speakAnswerBtn.addEventListener('click', () => speak(correctText, promptLang, speakAnswerBtn));
    }

    document.getElementById('conjugate-quit-btn').addEventListener('click', quitConjugateRound);

    renderQuitConfirmOverlay('conjugate');
  }

  function renderConjugateResult() {
    const app = document.getElementById('app');
    const score = state.conjugateResults.filter(r => r.correct).length;
    const total = state.conjugateResults.length;
    const streak = state.progress.conjugateStreak;

    let mosaicHtml = '';
    state.conjugateResults.forEach(r => {
      mosaicHtml += `<div class="sq" style="background:${r.correct ? COLORS.green : COLORS.red}"></div>`;
    });

    const missed = state.conjugateResults.filter(r => !r.correct);
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
      <div class="screen bg-conjugate">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="eyebrow" style="margin-bottom:4px;">Resultado</div>
            <div class="score-big" style="margin-bottom:12px;">${score}/${total}</div>
            ${state.conjugateNewBestStreak ? `<div class="new-best">🔥 New best streak: ${streak.best}</div>` : ''}
            <div class="streak-line">Current streak: ${streak.current} &nbsp;·&nbsp; Best: ${streak.best}</div>
            <div class="mosaic">${mosaicHtml}</div>
            ${reviewHtml}
            <button id="again-btn" class="btn-primary" style="width:100%; margin-bottom:10px;">Play again</button>
            <button id="settings-btn" class="btn-secondary" style="width:100%;">Change settings</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => leaveResults(goHome));
    document.getElementById('again-btn').addEventListener('click', () => leaveResults(startConjugateRound));
    document.getElementById('settings-btn').addEventListener('click', () => leaveResults(backToConjugateSetup));
  }
