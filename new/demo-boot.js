// /new landing-page demo — boot script.
//
// Loads last, after config.js/utils.js/audio.js/progress-xp.js/
// achievements.js/word-selection.js/game-quiz.js/render-quiz.js/
// render-hub.js/render-dispatch.js (all reused completely unmodified —
// see index.html's own comments for why each other file was left out).
//
// This file supplies its own throwaway `state` object rather than loading
// the real state.js, because state.js's progress field comes from
// loadProgress() — which reads localStorage['palabraProgress_v1'], the
// EXACT key the real signed-in app uses. If this device already has a
// real Palabra account, that read would be harmless on its own, but it
// would mean the demo starts from (and could visually display) someone's
// real progress instead of a fresh one. Building a brand new in-memory
// state/progress object here instead sidesteps that entirely — nothing
// in this file ever reads real app storage, and (see saveProgress()
// below) nothing it does ever writes to it either.
//
// Three small, deliberate overrides of otherwise-untouched game engine
// functions are defined at the bottom: saveProgress() (drop persistence
// entirely — Firestore push already no-ops with no state.user, so this
// only needs to skip the localStorage line), nextQuestion() (end the
// round after these fixed 8 questions instead of Stream's normal
// 20-question checkpoint/infinite-topup behavior), and render() (wrapped,
// not replaced — adds the demo-only "already have an account" escape
// hatch, the results-screen single CTA, and the hub click-gate).

  // ---- Word pool ----
  // The 8 curated target words plus filler so getDistractors() has real
  // candidates for multiple-choice options. Hardcoded rather than pulled
  // from words.xlsx on purpose — this page is the first thing an ad
  // visitor sees and can't depend on a spreadsheet fetch succeeding, and
  // shouldn't silently change if the real word list changes later.
  const DEMO_FILLER_WORDS = [
    { es: 'casa', en: 'house' },
    { es: 'perro', en: 'dog' },
    { es: 'gato', en: 'cat' },
    { es: 'libro', en: 'book' },
    { es: 'amigo', en: 'friend' },
    { es: 'día', en: 'day' },
    { es: 'noche', en: 'night' },
    { es: 'mesa', en: 'table' },
    { es: 'sol', en: 'sun' },
    { es: 'luna', en: 'moon' },
    { es: 'café', en: 'coffee' },
    { es: 'playa', en: 'beach' },
    { es: 'coche', en: 'car' },
    { es: 'niño', en: 'boy' },
  ];

  // The fixed 8-question order, agreed in advance: safe cognate wins to
  // open, one genuine stretch (agua, typed — no spelling giveaway) placed
  // second-to-last so the round still ends on a confident note either way.
  const DEMO_QUESTIONS = [
    { es: 'hotel', en: 'hotel', format: 'mc', direction: 'es-en' },
    { es: 'gracias', en: 'thank you', format: 'audio', direction: 'es-en' },
    { es: 'animal', en: 'animal', format: 'mc', direction: 'es-en' },
    { es: 'hola', en: 'hello', format: 'truefalse', direction: 'es-en' },
    { es: 'chocolate', en: 'chocolate', format: 'audio', direction: 'es-en' },
    {
      es: 'hospital', en: 'hospital', format: 'cloze', direction: 'es-en',
      sentence: 'Voy al hospital porque estoy enfermo.',
      sentenceTranslation: "I'm going to the hospital because I'm sick.",
    },
    { es: 'agua', en: 'water', format: 'type', direction: 'es-en' },
    { es: 'familia', en: 'family', format: 'truefalse', direction: 'es-en' },
  ];

  const DEMO_WORD_POOL = DEMO_QUESTIONS
    .map(q => ({ es: q.es, en: q.en }))
    .concat(DEMO_FILLER_WORDS);

  // ---- Throwaway state object ----
  // Same shape as the real state.js, minus loadProgress() (see header
  // comment) and minus every field only ever read by modes this page
  // never shows (Time Attack / Memory / Conjugate / category loading) —
  // harmless either way since reading an absent field just returns
  // undefined in JS, but there's no reason to carry fields nothing here
  // will ever look at.
  const state = {
    screen: 'demo-intro',
    user: null,
    username: '',
    showMenu: false,
    loading: false,
    error: '',
    showUpload: false,
    pairs: DEMO_WORD_POOL,
    mainPool: DEMO_WORD_POOL,
    questions: DEMO_QUESTIONS.map(q => ({ ...q })),
    index: 0,
    input: '',
    checked: false,
    wasCorrect: false,
    results: [],
    newBestThisRound: false,
    progress: defaultProgress(),
    effectiveAnswerMode: 'type',
    currentOptions: null,
    selectedOption: null,
    autoAdvanceTimer: null,
    autoAdvanceDelay: 0,
    celebrateTimer: null,
    celebrateVariant: null,
    celebrateNext: null,
    lastKnownLevel: null,
    pendingLevelUp: null,
    levelUpNextFn: null,
    levelUpTimer: null,
    queuedAchievementToasts: [],
    lastFlippedIndex: -1,
    lastWasTypo: false,
    resultMode: 'round',
    isDailyDoubleRound: false,
    // true for the whole round — this is what makes prepareQuestion()/
    // renderQuiz() use each question's own .format instead of a single
    // round-level answer mode. Flipped to false only at the very end,
    // matching the real stopStream()'s own behavior, purely so
    // renderResult() renders the same way a real Stream result would.
    isStreamRound: true,
    lastRoundWasStream: false,
    lastRoundWasSentences: false,
    streamCheckpointCount: 0,
    streamSessionStreak: 0,
    streamSessionCheckpoints: 0,
    streamFormatsCorrect: {},
    tfClaimEn: '',
    tfIsTrue: false,
    tfSessionStreak: 0,
    scrambleBank: [],
    scramblePlaced: [],
    scrambleSessionStreak: 0,
    activeCategory: null,
    categoryPairs: [],
    achievementGroup: null,
    // Not part of the real app's state shape — checked only by this
    // file's own render() wrapper and click-gate below.
    isDemoMode: true,
  };

  // The hub's "Today" panel (XP today / Words today) is a snapshot diff —
  // computeXP() now minus computeXP() at the moment todaySnapshot was last
  // baselined (progress-xp.js's ensureTodaySnapshot()/getTodayXP()). In
  // the real app that baseline always gets set on the hub's very first
  // render of the day, which always happens BEFORE Stream starts (Stream
  // is launched from the hub). This demo runs the opposite order —
  // questions happen before the hub is ever shown — so without this call,
  // the baseline would only get set the first time the hub renders, i.e.
  // AFTER the round, at the exact XP total just earned, making "today"
  // net out to zero. Calling it here, before any answer is recorded,
  // baselines it at the true starting point (0) instead.
  ensureTodaySnapshot();

  // ---- Stubs for the two cross-file calls this page's included files
  // still make, whose real implementations live in files deliberately not
  // loaded here (auth.js). Both are no-ops-with-a-guard in the real app
  // too when there's no signed-in user, so functionally this changes
  // nothing — it just avoids a ReferenceError since auth.js itself isn't
  // present to define them.
  function pingActivity() {}
  function syncBackHistory() {}

  // ---- Achievement gate ----
  // The demo is meant to feel like one genuine, modest win - "First
  // Steps" - not a fireworks show of every achievement a lucky perfect
  // run happens to qualify for. With only 8 questions, a player who
  // answers everything correctly (very possible - most of this lineup is
  // deliberately easy) would also legitimately qualify for Perfect Round,
  // Triple Threat, and Quadruple Threat all at once via the real
  // evaluateRoundAchievements()/recordAnswer() logic (untouched, see
  // below) - four unlocks' worth of bonus XP (20 each) stacked with the
  // streak/correct-answer XP was enough on its own to blow straight past
  // the real app's default 60 XP daily goal before the person even has an
  // account. Gating to firstRound only keeps that first real hub view
  // modest and genuine rather than looking already "maxed out" on day
  // one. Declared as a plain reassignment, not a `function` declaration -
  // a same-name function declaration here would hoist and shadow the
  // real achievements.js version before this line even runs, capturing
  // itself instead of the real implementation.
  const realUnlockAchievement = unlockAchievement;
  unlockAchievement = function (id) {
    if (id !== 'firstRound') return false;
    return realUnlockAchievement(id);
  };

  // ---- Safe persistence override ----
  // Firestore push already no-ops with no state.user (see the real
  // pushCloudProgressDebounced in cloud-sync.js — not loaded here anyway).
  // The only real risk was the localStorage.setItem line in the original
  // saveProgress(), which would write to the exact key the real signed-in
  // app reads from. Dropping it here means this whole page can safely
  // reuse the real recordAnswer()/unlockAchievement()/etc. machinery
  // unmodified — every one of them already routes through saveProgress()
  // rather than touching storage directly. checkLevelUp()/
  // checkDailyGoalCrossed() are kept since they only touch state fields
  // in memory.
  function saveProgress() {
    state.progressDirty = true;
    checkLevelUp();
    checkDailyGoalCrossed();
  }

  // ---- Demo-started notification ----
  // Mirrors notifyNewSignup() in auth.js exactly — same Telegram Bot API
  // call, same fire-and-forget/never-throws shape, reusing the same
  // TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID constants already loaded via
  // config.js (no new token, no new file). A failed or disabled
  // notification must never get in the way of someone actually starting
  // the demo.
  function notifyDemoStarted() {
    if (!TELEGRAM_CHAT_ID) return;
    try {
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: '🚀 Someone started the Palabra demo\nvia /new landing page',
        }),
      }).catch(() => {});
    } catch (e) { /* ignore — notification is best-effort only */ }
  }

  // ---- Fixed-length round override ----
  // The real nextQuestion() only ends a Stream round via the 20-question
  // checkpoint, topping up the batch with buildStreamBatch() (random
  // words/formats from whatever pool is active) whenever it runs low —
  // exactly what a curated, fixed 8-question demo must never do. This
  // replaces it with the same ending path Quiz/Sentences/Daily Double
  // already use once the fixed question list runs out, while still
  // relying on state.isStreamRound === true throughout the round itself
  // so prepareQuestion()/renderQuiz() keep using each question's own
  // per-question .format.
  function nextQuestion() {
    clearAutoAdvanceTimer();
    if (state.index + 1 >= state.questions.length) {
      const score = state.results.filter(r => r.correct).length;
      const total = state.results.length;
      const perfect = total > 0 && score === total;
      state.lastRoundWasStream = true;
      state.isStreamRound = false;
      suppressAchievementFX = true;
      evaluateRoundAchievements();
      suppressAchievementFX = false;
      showCelebration(perfect ? 'perfect' : 'finished', 'result');
      return;
    }
    state.index += 1;
    state.input = '';
    state.checked = false;
    prepareQuestion();
    render();
  }

  // ---- Signup handoff ----
  // Stashes exactly the fields auth.js's handleAuthSubmit() knows how to
  // fold into a brand-new signup (see js/auth.js), shows a brief message
  // so the jump to signup doesn't feel abrupt, then sends the person to
  // the real app's signup tab. Read and cleared there, once — never
  // touched by signing in to an existing account.
  let signupHandoffStarted = false;
  function goToSignupFromDemo() {
    // Guards against a double-tap on the hub (still possible during the
    // toast's own delay below) stacking a second toast and redirect.
    if (signupHandoffStarted) return;
    signupHandoffStarted = true;

    try {
      const handoff = {
        wordStats: state.progress.wordStats,
        streak: state.progress.streak,
        lifetime: state.progress.lifetime,
        achievements: state.progress.achievements,
        dailyStreak: state.progress.dailyStreak,
        lastActiveDate: state.progress.lastActiveDate,
        recentActiveDates: state.progress.recentActiveDates,
      };
      sessionStorage.setItem(DEMO_HANDOFF_KEY, JSON.stringify(handoff));
    } catch (e) {
      // Storage blocked (e.g. private browsing) — signup still proceeds
      // normally on the other end, just without the carried-over demo
      // progress.
    }

    // A centered modal, not a toast — reuses the Daily Double popup's own
    // shell classes (dd-modal-backdrop/dd-card/dd-ring-*, loaded via
    // daily-double.css) for the dimmed-background/centered-card look,
    // since a corner achievement-style toast read as a reward rather
    // than what this actually is: a requirement before continuing. Only
    // the shell and ring are reused — the eyebrow/headline/subline text
    // and icon are this modal's own, not Daily Double's multiplier
    // content.
    const modal = document.createElement('div');
    modal.className = 'dd-modal-backdrop';
    modal.innerHTML = `
      <div class="dd-card">
        <div class="dd-ring-outer">
          <div class="dd-ring-disc">
            <div class="dd-ring-inner"><span style="font-size:34px;">💾</span></div>
          </div>
        </div>
        <div class="dd-eyebrow">Almost there</div>
        <h2 class="dd-headline">Create your account</h2>
        <p class="dd-subline">to save your progress</p>
      </div>
    `;
    document.body.appendChild(modal);

    setTimeout(() => {
      window.location.href = '../index.html?signup=1';
    }, 1600);
  }

  // Sends someone straight to the real app, letting its own normal
  // initAuth() flow decide what they see — the sign-in form if they're
  // not currently signed in anywhere on this device, or straight to their
  // real hub if they already have an active session here.
  function goToSignInFromDemo() {
    window.location.href = '../index.html';
  }

  // ---- Intro screen ----
  // Shown first, before any question. Deliberately hand-authored here
  // rather than reusing renderStart() (render-hub.js) for this screen —
  // renderStart() draws the whole hub (Today panel, mode picker, level
  // ring, achievements row), all of which would show meaningless
  // all-zero stats before a single question's been answered. This reuses
  // the exact same CSS classes as renderStart()'s own hero card
  // (stream-hero/format-row/fchip/hub-start-btn/etc., all already loaded
  // via hub.css/components.css) so it's visually identical to the real
  // one — just this one card, no menu button (nothing behind it would do
  // anything meaningful pre-signup anyway), and the button always reads
  // "Start Stream" rather than the real card's playedToday-dependent
  // Continue/Start toggle, since this is always someone's first-ever
  // visit here.
  function renderDemoIntro() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="screen upload-screen bg-quiz">
        <div class="wrap">
          <div class="header-row" style="justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="badge"></span>
              <h1>Palabra</h1>
            </div>
          </div>
          <div class="card stream-hero hub-hero-pulse">
            <div class="format-row"><span class="fchip">🔤</span><span class="fchip">🔊</span><span class="fchip">✎</span></div>
            <h2>Your Learning Stream</h2>
            <p>Mixed questions — choose, listen, or type. Learn the words you need most, one after another.</p>
            <button id="demo-start-btn" class="btn-primary hub-start-btn">
              <span class="hub-play-chip">▶</span>Start Stream
            </button>
          </div>
          <button id="demo-signin-link-intro" class="link-btn" type="button" style="display:block; text-align:center; width:100%; margin-top:14px;">Already have an account? Sign in</button>
        </div>
      </div>
    `;
    document.getElementById('demo-start-btn').addEventListener('click', () => {
      notifyDemoStarted();
      state.screen = 'quiz';
      prepareQuestion();
      render();
    });
    document.getElementById('demo-signin-link-intro').addEventListener('click', goToSignInFromDemo);
  }

  // ---- render() wrapper ----
  // render-dispatch.js's render() itself is left completely untouched;
  // this wraps it rather than editing it, so every screen it already
  // knows how to draw (quiz/celebrate/result/start) keeps working exactly
  // as in the real app. One extra pseudo-screen ('demo-intro') is handled
  // entirely here, before ever reaching the real dispatcher — it doesn't
  // know that screen name and would silently render nothing for it.
  // Beyond that, three small, purely additive things happen after the
  // real render() returns, all gated on isDemoMode:
  //   1. quiz screen — an "Already have an account?" link under Quit.
  //   2. result screen — replace Play again/Change settings with a single
  //      "See your progress" button (agreed: only one path forward here).
  //   3. start (hub) screen — every click redirects to signup instead of
  //      performing its real action (see the capture-phase listener
  //      below, which handles this rather than this wrapper).
  const realRender = render;
  render = function () {
    if (state.isDemoMode && state.screen === 'demo-intro') {
      renderDemoIntro();
      return;
    }
    realRender();
    if (!state.isDemoMode) return;

    if (state.screen === 'quiz') {
      // The top progress-tile row: render-quiz.js's own renderQuiz()
      // builds this assuming a Stream round's 20-question checkpoint
      // block (state.streamCheckpointCount), which this demo's
      // nextQuestion() override deliberately never increments (see its
      // own comment above) - so left untouched it always drew a static
      // row of 20 slots with only the first one ever lit. Replaced here
      // with an 8-slot version using the exact same fill logic
      // render-quiz.js's own fixed-length (non-Stream) branch already
      // uses elsewhere, just inlined rather than calling it, since it's
      // markup generation, not a function this file can invoke directly.
      const tilesEl = document.querySelector('.tiles');
      if (tilesEl) {
        tilesEl.style.gridTemplateColumns = `repeat(${state.questions.length}, 1fr)`;
        let tilesHtml = '';
        state.questions.forEach((_, i) => {
          let bg = 'var(--outline)';
          if (i < state.results.length) bg = state.results[i].correct ? COLORS.green : COLORS.red;
          else if (i === state.index) bg = COLORS.ochre;
          tilesHtml += `<div class="tile" style="background:${bg}"></div>`;
        });
        tilesEl.innerHTML = tilesHtml;
      }

      const quitBtn = document.getElementById('quiz-quit-btn');
      if (quitBtn && !document.getElementById('demo-signin-link')) {
        const link = document.createElement('button');
        link.id = 'demo-signin-link';
        link.className = 'link-btn';
        link.type = 'button';
        link.style.display = 'block';
        link.style.textAlign = 'center';
        link.style.width = '100%';
        link.style.marginTop = '10px';
        link.textContent = 'Already have an account? Sign in';
        link.addEventListener('click', goToSignInFromDemo);
        quitBtn.insertAdjacentElement('afterend', link);
      }
    }

    if (state.screen === 'result') {
      const again = document.getElementById('again-btn');
      if (again) again.remove();
      const settings = document.getElementById('settings-btn');
      if (settings) settings.remove();
      const body = document.querySelector('.screen-body');
      if (body && !document.getElementById('demo-continue-btn')) {
        const cta = document.createElement('button');
        cta.id = 'demo-continue-btn';
        cta.className = 'btn-primary';
        cta.style.width = '100%';
        cta.style.marginBottom = '10px';
        cta.textContent = 'See your progress →';
        cta.addEventListener('click', () => { leaveResults(goHome); });
        body.appendChild(cta);
      }
    }
  };

  // ---- Hub click-gate ----
  // A single capture-phase listener on document, rather than editing
  // render-hub.js's own click handlers one by one. Capture-phase
  // listeners run before the bubble-phase listeners renderStart() attaches
  // directly to each tile/button, so stopImmediatePropagation() here
  // reliably stops the real handler (start stream, open settings, view
  // achievements, etc.) from ever firing — every tap on the mocked hub
  // leads to signup, exactly as agreed, with zero changes to render-hub.js
  // itself.
  document.addEventListener('click', function (e) {
    if (!state.isDemoMode || state.screen !== 'start') return;
    const app = document.getElementById('app');
    if (!app || !app.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    goToSignupFromDemo();
  }, true);

  // ---- Go ----
  // Shows the intro card first (see renderDemoIntro() above) —
  // prepareQuestion() is deferred until "Start Stream" is tapped, not run
  // here.
  render();
