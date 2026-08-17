// Renders the home hub and the game-mode picker screen.


  function renderStart() {
    if (state.needsCloudSync && state.user) {
      state.needsCloudSync = false;
      flushCloudSync().then(() => pullCloudProgress(state.user.uid)).then(render);
    }
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const streak = state.progress.streak;
    const xpLevel = getXPLevel(state.progress);
    const showDailyDouble = state.progress.dailyDoubleLastHandled !== todayDateString();

    let statusHtml = '';
    if (state.loading) {
      statusHtml = `<div class="status-line"><div class="spinner"></div> Loading word list from ${esc(WORDS_FILE)}…</div>`;
    } else if (state.error) {
      statusHtml = `<div class="msg-error">${esc(state.error)}</div>`;
    }

    let uploadHtml = '';
    if (!state.loading && state.showUpload) {
      uploadHtml = `
        <div class="card" style="margin-bottom:14px;">
          <label class="dropzone" for="file-upload" style="margin-bottom:0;">
            <div class="icon">📄</div>
            <div class="name">Choose Excel file</div>
            <div class="hint">Column A: Spanish · Column B: English</div>
          </label>
          <input id="file-upload" type="file" accept=".xlsx,.xls" style="display:none" />
        </div>
      `;
    }

    let menuHtml = '';
    if (state.showMenu) {
      menuHtml = `
        <div class="menu-overlay" id="menu-overlay"></div>
        <div class="menu-dropdown">
          <label class="menu-item" style="cursor:pointer;">Speak words aloud <input type="checkbox" id="autospeak-toggle" ${settings.autoSpeak ? 'checked' : ''} /></label>
          <label class="menu-item" style="cursor:pointer;">Sound effects <input type="checkbox" id="soundfx-toggle" ${settings.soundEffects ? 'checked' : ''} /></label>
          <button id="menu-export-btn" class="menu-item">⬇ Download progress</button>
          <button id="menu-import-btn" class="menu-item">⬆ Upload progress</button>
          ${state.user
            ? `<div class="menu-item" style="opacity:0.6; cursor:default;">${esc(state.user.email || 'Signed in')}</div>
               <div class="menu-item" style="display:flex; flex-direction:column; align-items:flex-start; gap:6px; cursor:default;">
                 <span>Username</span>
                 ${(state.editingUsername || !state.username) ? `
                   <div style="display:flex; gap:6px; width:100%;">
                     <input type="text" id="username-edit-input" value="${esc(state.username || '')}" placeholder="Pick a username" style="margin-bottom:0; flex:1; padding:8px 10px; font-size:14px;" />
                     <button id="username-save-btn" class="btn-secondary" style="padding:8px 14px; width:auto;">Save</button>
                   </div>
                 ` : `
                   <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                     <span style="font-weight:600;">${esc(state.username)}</span>
                     <button id="username-edit-btn" class="link-btn" type="button">Edit</button>
                   </div>
                 `}
               </div>
               <button id="menu-signout-btn" class="menu-item">🚪 Sign out</button>`
            : `<button id="menu-signin-btn" class="menu-item">👤 Sign in / Create account</button>`}
          <a href="https://t.me/Rwapps1" target="_blank" rel="noopener noreferrer" class="menu-item">
            <img src="dev-logo.png" alt="" class="dev-contact-logo-sm" />
            Live Chat on Telegram
          </a>
        </div>
      `;
    }

    const achIds = Object.keys(ACHIEVEMENTS);
    const achUnlockedCount = achIds.filter(id => state.progress.achievements[id] && state.progress.achievements[id].unlocked).length;
    const achTotalCount = achIds.length;
    const noWords = state.pairs.length === 0;
    const totalAnswered = state.progress.lifetime.totalAnswered + state.progress.conjugateLifetime.totalAnswered;

    app.innerHTML = `
      <div class="screen upload-screen bg-quiz">
        <div class="wrap">
          <div class="header-row" style="justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="badge"></span>
              <h1>Palabra</h1>
            </div>
            <button id="menu-btn" class="menu-btn">⋯</button>
          </div>
          <div class="stat-strip">
            <span class="streak-text">🔥 ${streak.current} &nbsp;·&nbsp; Best ${streak.best}${state.mainPool.length > 0 ? ` &nbsp;·&nbsp; ${state.mainPool.length} words` : ''}</span>
            <span class="divider"></span>
            <span class="level-mini">
              <span class="level-mini-text">XP</span>
              <span class="level-ring small" style="--pct:${xpLevel.pct}%;"><span class="level-ring-inner"><span class="level-ring-num">${xpLevel.level}</span></span></span>
            </span>
          </div>
          ${menuHtml}
          ${statusHtml}
          ${uploadHtml}
          <div class="card stream-hero">
            <div class="format-row"><span class="fchip">🔤</span><span class="fchip">🔊</span><span class="fchip">✎</span></div>
            <h2>Your Learning Stream</h2>
            <p>Mixed questions — choose, listen, or type. Learn the words you need most, one after another.</p>
            <button id="start-stream-btn" class="btn-primary" ${state.mainPool.length < 3 ? 'disabled' : ''}>Start Stream →</button>
          </div>
          <button class="game-tile modes-banner" data-tile="gamemodes">
            <div class="tile-icon-wrap" style="background:rgba(255,255,255,0.08);">🎮</div>
            <div class="banner-text">
              <div class="banner-name">Choose a specific mode</div>
              <div class="banner-meta">Quiz, Time Attack, Memory Match & more</div>
            </div>
            <div class="banner-arrow">→</div>
          </button>
          <button class="game-tile achievements-banner" data-tile="achievements">
            <div class="tile-icon-wrap" style="background:rgba(255,193,99,0.18);">🏆</div>
            <div class="banner-text">
              <div class="banner-name">Achievements</div>
              <div class="banner-meta">${achUnlockedCount}/${achTotalCount} unlocked</div>
            </div>
            <div class="banner-arrow">→</div>
          </button>
          <button class="game-tile progress-banner" data-tile="myprogress">
            <div class="tile-icon-wrap" style="background:rgba(201,168,255,0.18);">📊</div>
            <div class="banner-text">
              <div class="banner-name">My Progress</div>
              <div class="banner-meta">${totalAnswered} answers logged</div>
            </div>
            <div class="banner-arrow">→</div>
          </button>
          <button class="game-tile level-banner" data-tile="xpinfo">
            <span class="level-ring" style="--pct:${xpLevel.pct}%;"><span class="level-ring-inner"><span class="level-ring-num">${xpLevel.level}</span></span></span>
            <div class="banner-text">
              <div class="banner-name">Level ${xpLevel.level}</div>
              <div class="banner-meta"><span class="xp-track"><span class="xp-fill" style="width:${xpLevel.pct}%;"></span></span> ${xpLevel.xpIntoLevel} / ${xpLevel.xpForNextLevel} XP</div>
            </div>
            <div class="banner-arrow">→</div>
          </button>
          <input type="file" id="import-file" accept="application/json" style="display:none" />
        </div>
        ${showDailyDouble ? `
        <div class="dd-modal-backdrop" id="dd-modal-backdrop">
          <div class="dd-card">
            <div class="dd-ring-outer">
              <div class="dd-ring-disc"><div class="dd-ring-inner"><span class="dd-ring-num">2X</span></div></div>
            </div>
            <div class="dd-eyebrow">Power up your learning</div>
            <h2 class="dd-headline">Daily Double!</h2>
            <p class="dd-subline">10 of your least memorised words — double XP if you play them now.</p>
            <button id="dd-play-btn" class="dd-play-btn">Play now</button>
            <button id="dd-skip-btn" class="dd-skip-btn">Skip for today</button>
          </div>
        </div>
        ` : ''}
      </div>
    `;

    document.getElementById('import-file').addEventListener('change', (e) => {
      state.showMenu = false;
      importProgress(e.target.files[0]);
    });

    const startStreamBtn = document.getElementById('start-stream-btn');
    if (startStreamBtn) startStreamBtn.addEventListener('click', startStream);

    if (showDailyDouble) {
      document.getElementById('dd-play-btn').addEventListener('click', handleDailyDoublePlay);
      document.getElementById('dd-skip-btn').addEventListener('click', handleDailyDoubleSkip);
    }

    document.getElementById('menu-btn').addEventListener('click', () => {
      state.showMenu = !state.showMenu;
      render();
    });

    if (state.showMenu) {
      document.getElementById('menu-overlay').addEventListener('click', () => { state.showMenu = false; render(); });
      document.getElementById('autospeak-toggle').addEventListener('change', (e) => {
        state.progress.settings.autoSpeak = e.target.checked;
        saveProgress();
      });
      document.getElementById('soundfx-toggle').addEventListener('change', (e) => {
        state.progress.settings.soundEffects = e.target.checked;
        saveProgress();
      });
      document.getElementById('menu-export-btn').addEventListener('click', () => {
        state.showMenu = false;
        exportProgress();
        render();
      });
      document.getElementById('menu-import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
      });
      const signoutBtn = document.getElementById('menu-signout-btn');
      if (signoutBtn) {
        signoutBtn.addEventListener('click', () => {
          state.showMenu = false;
          window.PalabraAuth.signOut().then(() => {
            state.user = null;
            state.username = '';
            state.editingUsername = false;
            // Leave the device genuinely clean — nothing from this account
            // should linger to leak into whatever signs in or registers
            // here next.
            state.progress = defaultProgress();
            state.lastSyncedMs = 0;
            state.progressDirty = false;
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            state.screen = 'login';
            render();
          });
        });
      }
      const usernameSaveBtn = document.getElementById('username-save-btn');
      if (usernameSaveBtn) {
        usernameSaveBtn.addEventListener('click', () => {
          const newUsername = document.getElementById('username-edit-input').value.trim();
          state.username = newUsername;
          state.editingUsername = false;
          window.PalabraAuth.setUserDoc(state.user.uid, { username: newUsername || null }).catch(() => {
            // Offline or blocked — will still show locally; retries next save.
          });
          render();
        });
      }
      const usernameEditBtn = document.getElementById('username-edit-btn');
      if (usernameEditBtn) {
        usernameEditBtn.addEventListener('click', () => {
          state.editingUsername = true;
          render();
        });
      }
      const signinBtn = document.getElementById('menu-signin-btn');
      if (signinBtn) {
        signinBtn.addEventListener('click', () => {
          state.showMenu = false;
          state.screen = 'login';
          render();
        });
      }
    }

    if (state.showUpload) {
      const fileUpload = document.getElementById('file-upload');
      if (fileUpload) fileUpload.addEventListener('change', (e) => handleFile(e.target.files[0]));
    }

    document.querySelectorAll('.game-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const id = tile.dataset.tile;
        if (tile.disabled) return;
        if (id === 'gamemodes') { state.screen = 'game-modes'; render(); }
        else if (id === 'achievements') { state.screen = 'achievements'; render(); }
        else if (id === 'myprogress') { state.screen = 'my-progress'; render(); }
        else if (id === 'xpinfo') { state.screen = 'xp-info'; render(); }
      });
    });
  }

  // The 6 game-mode tiles, previously always visible on Home, now live
  // behind "Choose a specific mode" so Home reads as: start a stream, or
  // go pick something specific. Same tiles, same click behavior, just one
  // tap deeper — reusing .game-tile/.game-grid styling verbatim.
  function renderGameModes() {
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const taBest = state.progress.timeAttackBest || 0;
    const memBest = state.progress.memoryBest[settings.memoryGridSize];
    const noWords = state.pairs.length === 0;
    const sentenceCount = sentencePairs().length;
    const noSentenceWords = sentenceCount === 0;

    const tiles = [
      { id: 'quiz', icon: '🔤', name: 'Quiz', meta: 'Type or choose', color: 'rgba(255,107,74,0.18)', locked: false, gate: true },
      { id: 'sentences', icon: '📝', name: 'Sentences', meta: sentenceCount + ' sentences', color: 'rgba(201,168,255,0.18)', locked: false, gate: false, disabled: noSentenceWords },
      { id: 'timeattack', icon: '⏱', name: 'Time Attack', meta: taBest > 0 ? `Best: ${taBest}` : '60 seconds', color: 'rgba(45,212,191,0.18)', locked: false, gate: true },
      { id: 'memory', icon: '🧩', name: 'Memory Match', meta: memBest ? `Best: ${memBest} moves` : 'Find the pairs', color: 'rgba(217,70,239,0.18)', locked: false, gate: true },
      { id: 'verbs', icon: '📖', name: 'Conjugate', meta: 'Present tense', color: 'rgba(52,211,153,0.18)', locked: false, gate: false },
      { id: 'categories', icon: '🏷️', name: 'Categories', meta: CATEGORIES.length + ' topics', color: 'rgba(255,107,74,0.18)', locked: false, gate: false },
    ];

    const tilesHtml = tiles.map(t => `
      <button class="game-tile ${t.locked ? 'locked' : ''}" data-tile="${t.id}" ${(!t.locked && ((t.gate && noWords) || t.disabled)) ? 'disabled' : ''}>
        ${t.locked ? '<div class="tile-soon">Soon</div>' : ''}
        <div class="tile-icon-wrap" style="background:${t.color};">${t.icon}</div>
        <div class="tile-name">${esc(t.name)}</div>
        <div class="tile-meta">${esc(t.meta)}</div>
      </button>
    `).join('');

    app.innerHTML = `
      <div class="screen bg-quiz">
        <div class="wrap wrap-centered">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
            <div class="screen-title">Choose a mode</div>
          </div>
          <div class="game-grid">${tilesHtml}</div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'start'; render(); });

    document.querySelectorAll('.game-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const id = tile.dataset.tile;
        const def = tiles.find(t => t.id === id);
        if (def && def.locked) {
          showComingSoonToast(def.icon, def.name);
          return;
        }
        if (tile.disabled) return;
        if (id === 'quiz') { state.screen = 'quiz-setup'; render(); }
        else if (id === 'sentences') { state.screen = 'sentences-setup'; render(); }
        else if (id === 'timeattack') { state.screen = 'timeattack-setup'; render(); }
        else if (id === 'memory') { state.screen = 'memory-setup'; render(); }
        else if (id === 'categories') { state.screen = 'categories'; render(); }
        else if (id === 'verbs') { goToConjugateSetup(); }
      });
    });
  }
