// Renders Memory Match setup, play, and result screens.


  function renderMemorySetup() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const gridOptions = [['6', '6 pairs'], ['8', '8 pairs'], ['12', '12 pairs']];
    const gridHtml = gridOptions.map(([val, label]) =>
      `<button class="seg-btn ${settings.memoryGridSize === val ? 'active' : ''}" data-val="${val}">${label}</button>`
    ).join('');
    const best = state.progress.memoryBest[settings.memoryGridSize];
    const tooFew = state.mainPool.length < 2;

    app.innerHTML = `
      <div class="screen bg-memory">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="game-icon-badge" style="background:rgba(217,70,239,0.2);">🧩</div>
            <h1 style="font-size:30px; margin-bottom:24px;">Memory Match</h1>
            <div class="card" style="width:100%;">
              <div class="segmented" id="gridsize-group">${gridHtml}</div>
              <button id="start-btn" class="btn-primary" style="margin-top:22px;" ${tooFew ? 'disabled' : ''}>Start</button>
              ${best ? `<div style="text-align:center; font-size:12px; color:var(--cream-dim); margin-top:10px;">Best: ${best} moves</div>` : ''}
              ${tooFew ? `<div style="text-align:center; font-size:12px; color:var(--cream-dim); margin-top:10px;">Needs at least 2 words in your list.</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'game-modes'; render(); });
    document.getElementById('start-btn').addEventListener('click', startMemoryMatch);
    document.querySelectorAll('#gridsize-group .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.progress.settings.memoryGridSize = btn.dataset.val;
        saveProgress();
        render();
      });
    });
  }

  function renderMemoryPlay() {
    const app = document.getElementById('app');

    const tilesHtml = state.memoryTiles.map((tile, i) => {
      const isFlipped = state.memoryFlipped.includes(i) || tile.matched;
      let cls = 'memory-tile';
      if (!isFlipped) cls += ' face-down';
      if (tile.matched) cls += ' matched';
      if (state.memoryFlipped.length === 2 && !tile.matched && state.memoryFlipped.includes(i)) {
        const [a, b] = state.memoryFlipped;
        const ta = state.memoryTiles[a], tb = state.memoryTiles[b];
        if (ta.pairIndex !== tb.pairIndex) cls += ' mismatch';
      }
      if (state.memoryJustFlipped.includes(i)) cls += ' tile-flip';
      if (state.memoryReacting.includes(i)) cls += ' tile-reacting';
      const content = isFlipped ? esc(tile.text) : '❔';
      return `<button class="${cls}" data-idx="${i}" ${tile.matched ? 'disabled' : ''}>${content}</button>`;
    }).join('');

    app.innerHTML = `
      <div class="screen bg-memory">
        <div class="wrap">
          <div class="memory-stats-row">
            <div>Moves: <span>${state.memoryMoves}</span></div>
            <div>Pairs: <span>${state.memoryMatchedCount}/${state.memoryTotalPairs}</span></div>
            <div id="memory-timer">${formatMemoryTime(state.memorySeconds)}</div>
          </div>
          <div class="memory-grid">${tilesHtml}</div>
          <button id="memory-quit-btn" class="quit-link" style="display:block; text-align:center; width:100%;">Quit</button>
        </div>
      </div>
    `;

    document.querySelectorAll('.memory-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        flipMemoryTile(idx);
      });
    });

    document.getElementById('memory-quit-btn').addEventListener('click', quitMemoryMatch);

    renderQuitConfirmOverlay('memory-play');
  }

  function renderMemoryResult() {
    const app = document.getElementById('app');
    const best = state.progress.memoryBest[state.progress.settings.memoryGridSize];

    app.innerHTML = `
      <div class="screen bg-memory">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
          </div>
          <div class="screen-body">
            <div class="eyebrow" style="margin-bottom:4px;">Completado</div>
            <div class="score-big" style="margin-bottom:8px;">${state.memoryMoves}</div>
            <div class="streak-line">moves · ${formatMemoryTime(state.memorySeconds)}</div>
            ${state.memoryIsNewBest ? `<div class="new-best">🏆 New best!</div>` : (best ? `<div class="streak-line">Best: ${best} moves</div>` : '')}
            <button id="again-btn" class="btn-primary" style="width:100%; margin-bottom:10px; margin-top:8px;">Play again</button>
            <button id="settings-btn" class="btn-secondary" style="width:100%;">Change settings</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => leaveResults(goHome));
    document.getElementById('again-btn').addEventListener('click', () => leaveResults(startMemoryMatch));
    document.getElementById('settings-btn').addEventListener('click', () => leaveResults(backToMemorySetup));
  }
