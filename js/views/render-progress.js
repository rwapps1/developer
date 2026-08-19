// Renders Achievements, My Progress, and How-XP-Works screens.


  function renderAchievements() {
    const app = document.getElementById('app');

    const streamGroup = ACHIEVEMENT_GROUPS.find(g => g.id === 'stream');
    const gridGroups = ACHIEVEMENT_GROUPS.filter(g => g.id !== 'stream');

    const streamIds = achievementIdsForGroup(streamGroup);
    const streamUnlocked = streamIds.filter(id => state.progress.achievements[id] && state.progress.achievements[id].unlocked).length;
    const streamHtml = `
      <button class="game-tile stream-achievement-banner" data-group="${streamGroup.id}">
        <div class="tile-icon-wrap" style="background:${streamGroup.color};">${streamGroup.icon}</div>
        <div class="banner-text">
          <div class="banner-name">${esc(streamGroup.name)}</div>
          <div class="banner-meta">${streamUnlocked}/${streamIds.length} unlocked</div>
        </div>
        <div class="banner-arrow">→</div>
      </button>
    `;

    const tilesHtml = gridGroups.map(group => {
      const ids = achievementIdsForGroup(group);
      const unlockedCount = ids.filter(id => state.progress.achievements[id] && state.progress.achievements[id].unlocked).length;
      return `
        <button class="game-tile" data-group="${group.id}">
          <div class="tile-icon-wrap" style="background:${group.color};">${group.icon}</div>
          <div class="tile-name">${esc(group.name)}</div>
          <div class="tile-meta">${unlockedCount}/${ids.length} unlocked</div>
          <div class="tile-corner-arrow">→</div>
        </button>
      `;
    }).join('');

    app.innerHTML = `
      <div class="screen bg-achievements">
        <div class="wrap">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
            <div class="screen-title">🏆 Achievements</div>
          </div>
          ${streamHtml}
          <div class="game-grid">${tilesHtml}</div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', goHome);
    document.querySelectorAll('.game-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        state.achievementGroup = tile.dataset.group;
        state.screen = 'achievements-detail';
        render();
      });
    });
  }

  function renderAchievementGroup() {
    const app = document.getElementById('app');
    const group = ACHIEVEMENT_GROUPS.find(g => g.id === state.achievementGroup) || ACHIEVEMENT_GROUPS[0];
    const ids = achievementIdsForGroup(group);

    const itemsHtml = ids.map(id => {
      const def = ACHIEVEMENTS[id];
      const rec = state.progress.achievements[id];
      const unlocked = !!(rec && rec.unlocked);
      return `
        <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
          <div class="ach-icon">${unlocked ? def.icon : '🔒'}</div>
          <div class="ach-text">
            <div class="ach-name">${esc(def.name)}</div>
            <div class="ach-desc">${esc(def.desc)}</div>
          </div>
        </div>
      `;
    }).join('');

    app.innerHTML = `
      <div class="screen bg-achievements">
        <div class="wrap">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
            <div class="screen-title">${group.icon} ${esc(group.name)}</div>
          </div>
          <div class="card">
            ${itemsHtml}
          </div>
        </div>
      </div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => { state.screen = 'achievements'; render(); });
  }

  function renderMyProgress() {
    const app = document.getElementById('app');
    const p = state.progress;
    const xpLevel = getXPLevel(p);

    const vocabAccuracy = p.lifetime.totalAnswered > 0
      ? Math.round((p.lifetime.totalCorrect / p.lifetime.totalAnswered) * 100) : 0;
    const conjAccuracy = p.conjugateLifetime.totalAnswered > 0
      ? Math.round((p.conjugateLifetime.totalCorrect / p.conjugateLifetime.totalAnswered) * 100) : 0;

    const wordCounts = boxCounts(p.wordStats);
    const verbCounts = boxCounts(p.verbStats);
    const wordMax = Math.max(1, ...wordCounts);
    const verbMax = Math.max(1, ...verbCounts);

    const barsHtml = (counts, max, colorClass) => counts.map((count, i) => {
      const heightPct = count > 0 ? Math.max((count / max) * 100, 6) : 2;
      return `
        <div class="progress-bar-col">
          <div class="progress-bar-count">${count}</div>
          <div class="progress-bar ${colorClass}" style="height:${heightPct}%"></div>
          <div class="progress-bar-label">${i + 1}</div>
        </div>
      `;
    }).join('');

    const reviewWords = lowestBoxWords(5);
    const reviewWordsHtml = reviewWords.length ? reviewWords.map(ws => `
      <div class="progress-review-item">
        <div>
          <div class="progress-review-word">${esc(ws.es)}</div>
          <div class="progress-review-en">${esc(ws.en)}</div>
        </div>
        <div class="progress-box-tag ${ws.box >= 2 ? 'mid' : ''}">Box ${ws.box + 1}</div>
      </div>
    `).join('') : `<div class="progress-empty">Nothing to review yet — play a round first.</div>`;

    const reviewCombos = lowestBoxVerbCombos(5);
    const reviewCombosHtml = reviewCombos.length ? reviewCombos.map(vs => `
      <div class="progress-review-item">
        <div>
          <div class="progress-review-word">${esc(vs.es)} <span class="progress-review-person">(${esc(PERSON_LABELS[vs.person])})</span></div>
          <div class="progress-review-en">${esc(vs.en || '')}</div>
        </div>
        <div class="progress-box-tag ${vs.box >= 2 ? 'mid' : ''}">Box ${vs.box + 1}</div>
      </div>
    `).join('') : `<div class="progress-empty">Nothing to review yet — play a Conjugate round first.</div>`;

    app.innerHTML = `
      <div class="screen bg-progress">
        <div class="wrap">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
            <div class="screen-title">📊 My Progress</div>
          </div>

          <div class="progress-summary-row">
            <div class="card progress-summary-card">
              <div class="progress-summary-eyebrow">Vocabulary</div>
              <div class="progress-summary-big">${p.lifetime.totalAnswered}</div>
              <div class="progress-summary-big-label">words answered</div>
              <div class="progress-summary-stat"><span>Accuracy</span><span>${vocabAccuracy}%</span></div>
              <div class="progress-summary-stat"><span>Streak</span><span>${p.streak.current} · best ${p.streak.best}</span></div>
            </div>
            <div class="card progress-summary-card conjugate">
              <div class="progress-summary-eyebrow">Conjugation</div>
              <div class="progress-summary-big">${p.conjugateLifetime.totalAnswered}</div>
              <div class="progress-summary-big-label">verb forms answered</div>
              <div class="progress-summary-stat"><span>Accuracy</span><span>${conjAccuracy}%</span></div>
              <div class="progress-summary-stat"><span>Streak</span><span>${p.conjugateStreak.current} · best ${p.conjugateStreak.best}</span></div>
            </div>
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="progress-section-title">Box progress — Vocabulary</div>
            <div class="progress-section-sub">Box 6 words are the ones you've got locked in</div>
            <div class="progress-bars">${barsHtml(wordCounts, wordMax, '')}</div>
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="progress-section-title">Box progress — Conjugation</div>
            <div class="progress-section-sub">Verb + pronoun combos, same 6-box system</div>
            <div class="progress-bars">${barsHtml(verbCounts, verbMax, 'conjugate')}</div>
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="progress-section-title">Words to review</div>
            <div class="progress-section-sub">Lowest-box words right now</div>
            <div class="progress-review-list">${reviewWordsHtml}</div>
          </div>

          <div class="card" style="margin-top:14px; margin-bottom:14px;">
            <div class="progress-section-title">Verb combos to review</div>
            <div class="progress-section-sub">Lowest-box verb + pronoun pairs right now</div>
            <div class="progress-review-list">${reviewCombosHtml}</div>
          </div>

          <div class="card recap-row" style="margin-top:14px;">
            <span class="level-ring" style="--pct:${xpLevel.pct}%;"><span class="level-ring-inner"><span class="level-ring-num">${xpLevel.level}</span></span></span>
            <div class="recap-text">
              <div class="recap-level">Level ${xpLevel.level}</div>
              <div class="recap-sub">${xpLevel.xpIntoLevel} / ${xpLevel.xpForNextLevel} XP · ${xpLevel.xpForNextLevel - xpLevel.xpIntoLevel} XP to Level ${xpLevel.level + 1}</div>
              <span class="xp-track"><span class="xp-fill" style="width:${xpLevel.pct}%;"></span></span>
            </div>
          </div>

          <div class="section-label">Keep playing to earn XP</div>
          <div class="card">
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,193,99,0.18);">🌊</div>
              <div class="rule-text"><div class="rule-title">Stream</div><div class="rule-sub">Answer correctly — mixed, continuous practice, the best way to rack up XP</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,107,74,0.18);">📝</div>
              <div class="rule-text"><div class="rule-title">Quiz &amp; Categories</div><div class="rule-sub">Answer correctly</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(52,211,153,0.18);">🔤</div>
              <div class="rule-text"><div class="rule-title">Conjugate</div><div class="rule-sub">Answer correctly</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(45,212,191,0.18);">⚡</div>
              <div class="rule-text"><div class="rule-title">Time Attack</div><div class="rule-sub">Answer correctly against the clock</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(217,70,239,0.18);">🧩</div>
              <div class="rule-text"><div class="rule-title">Memory Match</div><div class="rule-sub">Clear a board — bigger boards count for more</div></div>
            </div>
          </div>

          <div class="section-label">Milestone bonuses</div>
          <div class="card">
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,77,109,0.18);">🔥</div>
              <div class="rule-text"><div class="rule-title">Beat your best streak</div><div class="rule-sub">In Quiz, Stream, or Conjugate</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,193,99,0.18);">🏆</div>
              <div class="rule-text"><div class="rule-title">Unlock an achievement</div><div class="rule-sub">Any of the ${Object.keys(ACHIEVEMENTS).length} badges, any game</div></div>
            </div>
          </div>

          <div class="footnote">Your level only ever goes up — it's a record of how much you've played, not a score you can lose.</div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', goHome);
  }

  function renderXPInfo() {
    const app = document.getElementById('app');
    const xpLevel = getXPLevel(state.progress);

    app.innerHTML = `
      <div class="screen bg-achievements">
        <div class="wrap">
          <div class="screen-header">
            <button id="back-btn" class="back-btn">←</button>
            <div class="screen-title">✨ How XP works</div>
          </div>

          <div class="card recap-row">
            <span class="level-ring" style="--pct:${xpLevel.pct}%;"><span class="level-ring-inner"><span class="level-ring-num">${xpLevel.level}</span></span></span>
            <div class="recap-text">
              <div class="recap-level">Level ${xpLevel.level}</div>
              <div class="recap-sub">${xpLevel.xpIntoLevel} / ${xpLevel.xpForNextLevel} XP · ${xpLevel.xpForNextLevel - xpLevel.xpIntoLevel} XP to Level ${xpLevel.level + 1}</div>
              <span class="xp-track"><span class="xp-fill" style="width:${xpLevel.pct}%;"></span></span>
            </div>
          </div>

          <div class="section-label">Keep playing to earn XP</div>
          <div class="card">
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,193,99,0.18);">🌊</div>
              <div class="rule-text"><div class="rule-title">Stream</div><div class="rule-sub">Answer correctly — mixed, continuous practice, the best way to rack up XP</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,107,74,0.18);">📝</div>
              <div class="rule-text"><div class="rule-title">Quiz &amp; Categories</div><div class="rule-sub">Answer correctly</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(52,211,153,0.18);">🔤</div>
              <div class="rule-text"><div class="rule-title">Conjugate</div><div class="rule-sub">Answer correctly</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(45,212,191,0.18);">⚡</div>
              <div class="rule-text"><div class="rule-title">Time Attack</div><div class="rule-sub">Answer correctly against the clock</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(217,70,239,0.18);">🧩</div>
              <div class="rule-text"><div class="rule-title">Memory Match</div><div class="rule-sub">Clear a board — bigger boards count for more</div></div>
            </div>
          </div>

          <div class="section-label">Milestone bonuses</div>
          <div class="card">
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,77,109,0.18);">🔥</div>
              <div class="rule-text"><div class="rule-title">Beat your best streak</div><div class="rule-sub">In Quiz, Stream, or Conjugate</div></div>
            </div>
            <div class="rule-row">
              <div class="rule-icon" style="background:rgba(255,193,99,0.18);">🏆</div>
              <div class="rule-text"><div class="rule-title">Unlock an achievement</div><div class="rule-sub">Any of the ${Object.keys(ACHIEVEMENTS).length} badges, any game</div></div>
            </div>
          </div>

          <div class="footnote">Your level only ever goes up — it's a record of how much you've played, not a score you can lose.</div>
        </div>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', goHome);
  }
