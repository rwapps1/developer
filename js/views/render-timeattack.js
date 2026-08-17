// Renders Time Attack setup, play, and result screens.


  function renderTimeAttackSetup() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const taBest = state.progress.timeAttackBest || 0;

    const directionOptions = [['mixed', 'Mixed'], ['es-en', 'ES → EN'], ['en-es', 'EN → ES']];
    const answerModeOptions = [['type', 'Type it'], ['choice', 'Multi']];

    const directionHtml = directionOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.direction === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');
    const answerModeHtml = answerModeOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.answerMode === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');

    app.innerHTML = `
      <div class="screen bg-timeattack">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="game-icon-badge" style="background:rgba(45,212,191,0.2);">⏱</div>
            <h1 style="font-size:30px; margin-bottom:24px;">Time Attack</h1>
            <div class="card" style="width:100%;">
              <div class="segmented" id="direction-group">${directionHtml}</div>
              <div class="segmented" id="answermode-group" style="margin-top:14px;">${answerModeHtml}</div>
              <button id="start-btn" class="btn-primary" style="margin-top:22px;" ${state.mainPool.length === 0 ? 'disabled' : ''}>Start — 60 seconds</button>
              ${taBest > 0 ? `<div style="text-align:center; font-size:12px; color:var(--cream-dim); margin-top:10px;">Best: ${taBest}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'game-modes'; render(); });
    document.getElementById('start-btn').addEventListener('click', startTimeAttack);

    document.querySelectorAll('#direction-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.progress.settings.direction = btn.dataset.val;
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

  function renderTimeAttack() {
    const app = document.getElementById('app');
    const current = state.taCurrentQuestion;
    if (!current) return;

    const promptWord = primaryText(current.direction === 'es-en' ? current.es : current.en);
    const promptLang = current.direction === 'es-en' ? 'es-ES' : 'en-US';
    const promptNote = current.direction !== 'es-en' ? (current.note || '') : '';

    let bottomHtml;
    if (state.effectiveAnswerMode === 'choice' && state.taCurrentOptions) {
      let optHtml = '<div class="option-list" id="ta-options">';
      state.taCurrentOptions.forEach(opt => {
        optHtml += `<button class="option-btn">${esc(opt)}</button>`;
      });
      optHtml += '</div>';
      bottomHtml = optHtml;
    } else {
      bottomHtml = `
        <input id="ta-input" type="text" placeholder="Type the translation…" value="${esc(state.taInput)}" autocomplete="off" />
        <button id="ta-check-btn" class="btn-primary">Check</button>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-timeattack">
        <div class="wrap">
          <div class="ta-header">
            <div class="ta-timer-track"><div class="ta-timer-fill" id="ta-timer-fill" style="width:${(state.taTimeLeft / 60 * 100)}%;"></div></div>
            <div class="ta-stats-row">
              <div class="ta-score-label">Score: <span id="ta-score">${state.taScore}</span></div>
              <div class="ta-timer-label" id="ta-timer">${state.taTimeLeft}s</div>
            </div>
          </div>
          <div class="prompt-card" id="ta-prompt-card">
            <div class="prompt-row">
              <div class="prompt-word">${esc(promptWord)}</div>
              <button id="ta-speak-btn" class="speak-btn" title="Hear it">🔊</button>
            </div>
            ${promptNote ? `<div class="prompt-note">${esc(promptNote)}</div>` : ''}
          </div>
          ${bottomHtml}
          <button id="ta-quit-btn" class="quit-link" style="display:block; text-align:center; width:100%; margin-top:14px;">Quit</button>
        </div>
      </div>
    `;

    const speakBtn = document.getElementById('ta-speak-btn');
    speakBtn.addEventListener('click', () => speak(promptWord, promptLang, speakBtn));
    if (state.progress.settings.autoSpeak) speak(promptWord, promptLang, speakBtn);

    if (state.effectiveAnswerMode === 'choice' && state.taCurrentOptions) {
      document.querySelectorAll('#ta-options .option-btn').forEach((btn, i) => {
        btn.addEventListener('click', () => taSelectOption(state.taCurrentOptions[i]));
      });
    } else {
      const input = document.getElementById('ta-input');
      input.focus();
      input.addEventListener('input', (e) => { state.taInput = e.target.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          handleTaTypedSubmit();
        }
      });
      document.getElementById('ta-check-btn').addEventListener('click', handleTaTypedSubmit);
    }

    document.getElementById('ta-quit-btn').addEventListener('click', quitTimeAttack);
  }

  function renderTimeAttackResult() {
    const app = document.getElementById('app');
    const missed = state.results.filter(r => !r.correct);
    const best = state.progress.timeAttackBest || 0;

    let reviewHtml = '';
    if (missed.length > 0) {
      let itemsHtml = '';
      missed.slice(0, 20).forEach(r => {
        itemsHtml += `
          <div class="review-item">
            <span class="from">${esc(r.prompt)}</span> → <span class="to">${esc(r.correctAnswer)}</span>
          </div>
        `;
      });
      reviewHtml = `
        <div class="card" style="margin-bottom:20px;">
          <div class="review-title">Words to review</div>
          ${itemsHtml}
          ${missed.length > 20 ? `<div style="font-size:12px;color:var(--cream-dim);margin-top:8px;">+ ${missed.length - 20} more</div>` : ''}
        </div>
      `;
    }

    app.innerHTML = `
      <div class="screen bg-timeattack">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="eyebrow" style="margin-bottom:4px;">Contra reloj</div>
            <div class="score-big" style="margin-bottom:8px;">${state.taScore}</div>
            <div class="streak-line">correct in 60 seconds</div>
            ${state.taIsNewBest ? `<div class="new-best">🏆 New best score!</div>` : `<div class="streak-line">Best: ${best}</div>`}
            ${reviewHtml}
            <button id="ta-again-btn" class="btn-primary" style="width:100%; margin-bottom:10px;">Play again</button>
            <button id="ta-settings-btn" class="btn-secondary" style="width:100%;">Change settings</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => leaveResults(goHome));
    document.getElementById('ta-again-btn').addEventListener('click', () => leaveResults(startTimeAttack));
    document.getElementById('ta-settings-btn').addEventListener('click', () => leaveResults(backToTimeAttackSetup));
  }
