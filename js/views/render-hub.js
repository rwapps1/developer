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
        <div class="menu-overlay" id="menu-overlay"></div>
        <div class="menu-dropdown">
          <label class="menu-item" style="cursor:pointer;">Speak words aloud <input type="checkbox" id="autospeak-toggle" ${settings.autoSpeak ? 'checked' : ''} /></label>
          <label class="menu-item" style="cursor:pointer;">Sound effects <input type="checkbox" id="soundfx-toggle" ${settings.soundEffects ? 'checked' : ''} /></label>
          <div class="menu-item" style="display:flex; flex-direction:column; align-items:flex-start; gap:6px; cursor:default;">
            <span>Daily XP goal</span>
            ${state.editingXPGoal ? `
              <div style="display:flex; gap:6px; width:100%;">
                <input type="number" id="xpgoal-edit-input" min="1" step="1" value="${state.progress.dailyXPGoal}" style="margin-bottom:0; flex:1; padding:8px 10px; font-size:14px;" />
                <button id="xpgoal-save-btn" class="btn-secondary" style="padding:8px 14px; width:auto;">Save</button>
              </div>
            ` : `
              <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                <span style="font-weight:600;">${state.progress.dailyXPGoal}</span>
                <button id="xpgoal-edit-btn" class="link-btn" type="button">Edit</button>
              </div>
            `}
          </div>
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
    const totalAnswered = state.progress.lifetime.totalAnswered + state.progress.conjugateLifetime.totalAnswered;

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
          ${menuHtml}
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
                <span class="today-stat-lbl">${todayXP >= xpGoal ? 'Goal met!' : 'XP today'}</span>
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
                  <div class="foot-title">${ddReady ? 'Daily Double ready' : 'Daily Double claimed'}</div>
                  <div class="foot-sub">${ddReady ? 'Double XP on your lowest-box words' : 'Come back tomorrow for another'}</div>
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

          <button class="progress-card" data-tile="myprogress" type="button">
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
              <h3>Level ${xpLevel.level}</h3>
              <div class="xp-line"><b>${xpLevel.xpIntoLevel}</b> / ${xpLevel.xpForNextLevel} XP to next level</div>
              <div class="sub-link">📊 ${totalAnswered} answers logged</div>
            </div>
          </button>

          <button class="ach-row" data-tile="achievements" type="button">
            <span class="aico">🏆</span>
            <span class="atext"><b>${achUnlockedCount} / ${achTotalCount}</b> achievements unlocked</span>
          </button>

          <input type="file" id="import-file" accept="application/json" style="display:none" />
        </div>
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
