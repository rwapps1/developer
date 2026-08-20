// Renders the home hub and the game-mode picker screen.


  const WEEK_PIP_DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const HUB_RING_RADIUS = 34;
  const HUB_RING_CIRCUMFERENCE = 2 * Math.PI * HUB_RING_RADIUS;

  function renderStart() {
    if (state.needsCloudSync && state.user) {
      state.needsCloudSync = false;
      flushCloudSync().then(() => pullCloudProgress(state.user.uid)).then(render);
    }
    const app = document.getElementById('app');
    const settings = state.progress.settings;
    const streak = state.progress.streak;
    const xpLevel = getXPLevel(state.progress);
    // Combined word+verb box distribution for the hub teaser strip — same
    // boxCounts() the My Progress screen uses per-stats-object, summed here
    // since the hub only needs one overall shape, not the word/verb split.
    const hubWordBoxCounts = boxCounts(state.progress.wordStats);
    const hubVerbBoxCounts = boxCounts(state.progress.verbStats);
    const hubBoxCounts = hubWordBoxCounts.map((n, i) => n + hubVerbBoxCounts[i]);
    const hubBoxTotal = hubBoxCounts.reduce((a, b) => a + b, 0);
    const hubBoxStripHtml = hubBoxCounts.map((n, i) => {
      const pct = hubBoxTotal > 0 ? (n / hubBoxTotal) * 100 : 0;
      return `<div class="box-seg box-seg-${i + 1}" style="flex-grow:${(n || 0.0001)}" title="Box ${i + 1}: ${n} word${n === 1 ? '' : 's'} (${Math.round(pct)}%)"></div>`;
    }).join('');
    // Footer copy: which box has the most words right now. No due/overdue
    // language here deliberately — this strip shows mastery shape, not a
    // to-do count (selection is a soft weighted pick, not a due-list, so a
    // "due" number here would promise something the app doesn't guarantee).
    let hubBoxFootText = 'Start practicing to build your box breakdown';
    if (hubBoxTotal > 0) {
      const maxIdx = hubBoxCounts.indexOf(Math.max(...hubBoxCounts));
      hubBoxFootText = `Most words sitting in Box ${maxIdx + 1}`;
    }
    // "Played today" reuses the same lastActiveDate the daily streak is
    // built on — no separate flag needed, see progress-xp.js markDailyActivity().
    const playedToday = state.progress.lastActiveDate === todayDateString();
    const ddReady = state.progress.dailyDoubleLastHandled !== todayDateString();

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
        <div class="sheet-backdrop" id="menu-overlay"></div>
        <div class="settings-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <div class="sheet-title">Settings</div>
            <button id="menu-close-btn" class="sheet-close" type="button" aria-label="Close">✕</button>
          </div>

          <div class="sheet-group-label">Preferences</div>
          <div class="sheet-card">
            <div class="sheet-row">
              <span class="row-label">Speak words aloud</span>
              <label class="switch">
                <input type="checkbox" id="autospeak-toggle" ${settings.autoSpeak ? 'checked' : ''} />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>
            </div>
            <div class="sheet-row">
              <span class="row-label">Sound effects</span>
              <label class="switch">
                <input type="checkbox" id="soundfx-toggle" ${settings.soundEffects ? 'checked' : ''} />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>
            </div>
            <div class="sheet-row sheet-row-stack">
              ${state.editingXPGoal ? `
                <span class="row-label">Daily XP goal</span>
                <div class="edit-form">
                  <input type="number" id="xpgoal-edit-input" min="1" step="1" value="${state.progress.dailyXPGoal}" />
                  <button id="xpgoal-save-btn" class="edit-save-btn" type="button">Save</button>
                </div>
              ` : `
                <div class="edit-row-static">
                  <span class="row-label">Daily XP goal</span>
                  <span class="edit-value">${state.progress.dailyXPGoal}</span>
                </div>
                <div class="edit-link-row">
                  <button id="xpgoal-edit-btn" class="link-btn" type="button">Edit</button>
                </div>
              `}
            </div>
          </div>

          <div class="sheet-group-label">Account &amp; data</div>
          <div class="sheet-card">
            ${state.user ? `
              <div class="account-email">${esc(state.user.email || 'Signed in')}</div>
              <div class="sheet-row sheet-row-stack">
                ${(state.editingUsername || !state.username) ? `
                  <span class="row-label">Username</span>
                  <div class="edit-form">
                    <input type="text" id="username-edit-input" value="${esc(state.username || '')}" placeholder="Pick a username" />
                    <button id="username-save-btn" class="edit-save-btn" type="button">Save</button>
                  </div>
                ` : `
                  <div class="edit-row-static">
                    <span class="row-label">Username</span>
                    <span class="edit-value">${esc(state.username)}</span>
                  </div>
                  <div class="edit-link-row">
                    <button id="username-edit-btn" class="link-btn" type="button">Edit</button>
                  </div>
                `}
              </div>
            ` : ''}
            <button id="menu-export-btn" class="sheet-row actionable sheet-row-btn" type="button">
              <span class="row-left"><span class="row-icon-badge dl">📥</span><span class="row-label">Download progress</span></span>
            </button>
            <button id="menu-import-btn" class="sheet-row actionable sheet-row-btn" type="button">
              <span class="row-left"><span class="row-icon-badge ul">📤</span><span class="row-label">Upload progress</span></span>
            </button>
          </div>

          ${state.user
            ? `<div class="sheet-card signout-card">
                 <button id="menu-signout-btn" class="sheet-row actionable sheet-row-btn" type="button">
                   <span class="row-left"><span class="row-icon">🚪</span><span class="row-label">Sign out</span></span>
                 </button>
               </div>`
            : `<div class="sheet-card">
                 <button id="menu-signin-btn" class="sheet-row actionable sheet-row-btn" type="button">
                   <span class="row-left"><span class="row-icon">👤</span><span class="row-label">Sign in / Create account</span></span>
                 </button>
               </div>`}

          <a href="https://t.me/Rwapps1" target="_blank" rel="noopener noreferrer" class="telegram-row">
            <img src="dev-logo.png" alt="" class="dev-contact-logo-sm" />
            <span class="telegram-link-text">Live Chat on Telegram</span>
          </a>
        </div>
      `;
    }

    const achIds = Object.keys(ACHIEVEMENTS);
    const achUnlockedCount = achIds.filter(id => state.progress.achievements[id] && state.progress.achievements[id].unlocked).length;
    const achTotalCount = achIds.length;

    // ---- Today panel data ----
    const todayXP = getTodayXP();
    const todayWords = getTodayWordsCount();
    const xpGoal = state.progress.dailyXPGoal || DEFAULT_DAILY_XP_GOAL;
    const xpGoalPct = Math.max(0, Math.min(100, Math.round((todayXP / xpGoal) * 100)));
    const dailyStreak = state.progress.dailyStreak;
    const weekPips = getWeekPips();
    const weekPipsHtml = weekPips.map((p, i) => `
      <div class="pip-col">
        <span class="pip-day">${WEEK_PIP_DAY_LETTERS[i]}</span>
        <span class="pip ${p.filled ? 'filled' : ''} ${p.isToday ? 'today' : ''}"></span>
      </div>
    `).join('');

    const teaser = getAchievementTeaser();
    const teaserHtml = teaser ? `
        <button class="today-foot-row" id="ach-teaser-row" type="button">
          <div class="foot-icon trophy">🏆</div>
          <div class="foot-text">
            <div class="foot-title">${teaser.remaining} away from ${esc(teaser.def.name)}</div>
            <div class="foot-sub">${achUnlockedCount} / ${achTotalCount} achievements unlocked</div>
          </div>
        </button>
      ` : '';

    // ---- Merged Level/Progress card ring ----
    const ringOffset = HUB_RING_CIRCUMFERENCE * (1 - xpLevel.pct / 100);

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
          ${statusHtml}
          ${uploadHtml}
          <div class="card stream-hero hub-hero-pulse ${playedToday ? 'calm' : ''}">
            <div class="format-row"><span class="fchip">🔤</span><span class="fchip">🔊</span><span class="fchip">✎</span></div>
            <h2>Your Learning Stream</h2>
            <p>Mixed questions — choose, listen, or type. Learn the words you need most, one after another.</p>
            <button id="start-stream-btn" class="btn-primary hub-start-btn" ${state.mainPool.length < 3 ? 'disabled' : ''}>
              <span class="hub-play-chip">▶</span>${playedToday ? 'Continue Stream' : 'Start Stream'}
            </button>
          </div>

          <div class="today-panel">
            <div class="today-hero-row">
              <div class="today-flame-wrap">
                <div class="today-flame-num"><span class="today-flame-emoji">🔥</span>${dailyStreak.current}</div>
                <div class="today-streak-label">Day streak</div>
              </div>
              <div class="today-week-pips">${weekPipsHtml}</div>
            </div>

            <div class="today-divider"></div>

            <div class="today-stat-grid">
              <div class="today-stat ${todayXP >= xpGoal ? 'goal-met' : ''}">
                <span class="today-stat-icon">${todayXP >= xpGoal ? '✅' : '⚡'}</span>
                <span class="today-stat-num">${todayXP} / ${xpGoal}</span>
                <span class="today-stat-lbl">${todayXP >= xpGoal ? 'XP Goal Met' : 'XP today'}</span>
                <div class="today-xp-bar"><div class="today-xp-bar-fill ${todayXP >= xpGoal ? 'goal-met' : ''}" style="width:${xpGoalPct}%;"></div></div>
              </div>
              <div class="today-stat">
                <span class="today-stat-icon">📝</span>
                <span class="today-stat-num">${todayWords}</span>
                <span class="today-stat-lbl">Words today</span>
              </div>
              <div class="today-stat">
                <span class="today-stat-icon">🎯</span>
                <span class="today-stat-num">${streak.current}</span>
                <span class="today-stat-lbl">Current streak</span>
              </div>
              <div class="today-stat">
                <span class="today-stat-icon">🏆</span>
                <span class="today-stat-num">${streak.best}</span>
                <span class="today-stat-lbl">Best streak</span>
              </div>
            </div>

            <div class="today-footer">
              <button class="today-foot-row" id="dd-row" type="button" ${ddReady ? '' : 'disabled'}>
                <div class="foot-icon gift ${ddReady ? '' : 'claimed'}">${ddReady ? '🎁' : '✓'}</div>
                <div class="foot-text">
                  <div class="foot-title">${ddReady ? 'Daily Double' : 'Daily Double'}</div>
                  <div class="foot-sub">${ddReady ? 'Double XP on your lowest-box words' : 'Come back tomorrow for another bonus'}</div>
                </div>
                <div class="foot-cta ${ddReady ? '' : 'claimed'}">${ddReady ? 'Claim' : 'Claimed'}</div>
              </button>
              ${teaserHtml}
            </div>
          </div>

          <button class="mode-tile" data-tile="gamemodes" type="button">
            <div class="mode-tile-top">
              <h3>Choose a specific mode</h3>
              <div class="hub-play-chip mode-tile-chip">▶</div>
            </div>
            <div class="mode-preview">
              <div class="mode-chip"><span class="mico">🔤</span><span class="mlabel">Quiz</span></div>
              <div class="mode-chip"><span class="mico">⏱️</span><span class="mlabel">Time<br>Attack</span></div>
              <div class="mode-chip"><span class="mico">🧠</span><span class="mlabel">Memory<br>Match</span></div>
              <div class="mode-chip"><span class="mico">🔄</span><span class="mlabel">Conjugate</span></div>
              <div class="mode-chip"><span class="mico">🗂️</span><span class="mlabel">Categories</span></div>
            </div>
          </button>

          <button class="progress-card" data-tile="myprogress" type="button" aria-label="View full progress breakdown">
            <div class="ring-wrap">
              <svg width="76" height="76" viewBox="0 0 76 76">
                <defs>
                  <linearGradient id="hubRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffd27a"/>
                    <stop offset="100%" stop-color="#ffb84d"/>
                  </linearGradient>
                </defs>
                <circle class="ring-track" cx="38" cy="38" r="${HUB_RING_RADIUS}"/>
                <circle class="ring-fill" cx="38" cy="38" r="${HUB_RING_RADIUS}"
                  stroke-dasharray="${HUB_RING_CIRCUMFERENCE.toFixed(1)}" stroke-dashoffset="${ringOffset.toFixed(1)}"/>
              </svg>
              <div class="ring-level">${xpLevel.level}</div>
            </div>
            <div class="progress-info">
              <div class="progress-info-top">
                <h3>Level ${xpLevel.level}</h3>
                <svg class="progress-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="xp-line"><b>${xpLevel.xpIntoLevel}</b> / ${xpLevel.xpForNextLevel} XP to next level</div>
              <div class="box-strip-wrap">
                <div class="box-strip-label">Box 1 → 6</div>
                <div class="box-strip">${hubBoxStripHtml}</div>
                <div class="box-strip-foot">${esc(hubBoxFootText)}</div>
              </div>
            </div>
          </button>

          <button class="ach-row" data-tile="achievements" type="button">
            <span class="aico">🏆</span>
            <span class="atext"><b>${achUnlockedCount} / ${achTotalCount}</b> achievements unlocked</span>
          </button>

          <input type="file" id="import-file" accept="application/json" style="display:none" />
        </div>
        ${menuHtml}
      </div>
    `;

    document.getElementById('import-file').addEventListener('change', (e) => {
      state.showMenu = false;
      importProgress(e.target.files[0]);
    });

    const startStreamBtn = document.getElementById('start-stream-btn');
    if (startStreamBtn) startStreamBtn.addEventListener('click', startStream);

    const ddRow = document.getElementById('dd-row');
    if (ddRow && ddReady) ddRow.addEventListener('click', handleDailyDoublePlay);

    const teaserRow = document.getElementById('ach-teaser-row');
    if (teaserRow) {
      teaserRow.addEventListener('click', () => {
        state.achievementGroup = groupIdForAchievement(teaser.id);
        state.screen = 'achievements-detail';
        render();
      });
    }

    document.getElementById('menu-btn').addEventListener('click', () => {
      state.showMenu = !state.showMenu;
      render();
    });

    if (state.showMenu) {
      document.getElementById('menu-overlay').addEventListener('click', () => { state.showMenu = false; render(); });
      document.getElementById('menu-close-btn').addEventListener('click', () => { state.showMenu = false; render(); });
      document.getElementById('autospeak-toggle').addEventListener('change', (e) => {
        state.progress.settings.autoSpeak = e.target.checked;
        saveProgress();
      });
      document.getElementById('soundfx-toggle').addEventListener('change', (e) => {
        state.progress.settings.soundEffects = e.target.checked;
        saveProgress();
      });
      document.getElementById('xpgoal-save-btn') && document.getElementById('xpgoal-save-btn').addEventListener('click', () => {
        const val = parseInt(document.getElementById('xpgoal-edit-input').value, 10);
        state.progress.dailyXPGoal = (Number.isFinite(val) && val > 0) ? val : DEFAULT_DAILY_XP_GOAL;
        state.editingXPGoal = false;
        saveProgress();
        render();
      });
      document.getElementById('xpgoal-edit-btn') && document.getElementById('xpgoal-edit-btn').addEventListener('click', () => {
        state.editingXPGoal = true;
        render();
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
            state.editingXPGoal = false;
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

    const modeTile = document.querySelector('.mode-tile');
    if (modeTile) modeTile.addEventListener('click', () => { state.screen = 'game-modes'; render(); });

    const progressCard = document.querySelector('.progress-card');
    if (progressCard) progressCard.addEventListener('click', () => { state.screen = 'my-progress'; render(); });

    const achRow = document.querySelector('.ach-row');
    if (achRow) achRow.addEventListener('click', () => { state.screen = 'achievements'; render(); });
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
