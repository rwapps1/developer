// Hardware/gesture back-button history handling. MUST load after all four
// game-*.js files - BACK_QUIT_HANDLERS references quitQuiz, quitTimeAttack,
// quitMemoryMatch, and quitConjugateRound directly in a top-level object
// literal, which throws immediately at parse time if they are not yet
// defined.


  // ---- Hardware/browser back button ------------------------------------
  // By default a phone's back button/gesture has nothing of this app's own
  // to act on (no history entries are pushed anywhere), so it falls straight
  // through to whatever's underneath - the previous website in a normal
  // browser tab, or closing the Activity entirely in the APK. This section
  // makes back navigate within the app instead, using the History API.
  //
  // Design: every non-floor screen gets its own real history entry - no
  // attempt to collapse multiple menu levels into a shared slot (an earlier
  // version tried that and broke as soon as the user went two levels deep,
  // e.g. Achievements -> an achievement group - because going deeper just
  // relabelled the one entry instead of adding a new one, so there was only
  // ever a single real pop available no matter how many screens you'd
  // actually visited). Landing back on the floor (start/login) instead
  // sheds everything accumulated in one `history.go()` jump, so exact depth
  // never has to matter once you're home again - a further back press there
  // genuinely exits (closes the APK / leaves to the previous page).
  //
  // Every screen falls into exactly one of three special buckets:
  //   - floor: start, login - see above.
  //   - swallow: round-end / celebration screens - back does nothing at
  //     all. These are reached automatically (timers, round completion),
  //     never chosen by the user, so there's nothing sensible to return to.
  //   - quit: the four active-play screens - back triggers the exact same
  //     "quit this round?" confirm as the on-screen Quit button, not real
  //     navigation.
  // Everything else (menu/setup/detail screens) already has its own
  // "back-btn" wired by its render function - hardware back just clicks it,
  // so behavior is guaranteed identical to tapping the on-screen arrow, and
  // the resulting screen change re-arms itself the normal way below.
  const BACK_FLOOR_SCREENS = new Set(['start', 'login']);
  const BACK_SWALLOW_SCREENS = new Set(['celebrate', 'level-up', 'stream-checkpoint', 'result', 'conjugate-result', 'memory-result']);
  const BACK_QUIT_HANDLERS = {
    quiz: quitQuiz,
    timeattack: quitTimeAttack,
    'memory-play': quitMemoryMatch,
    conjugate: quitConjugateRound,
  };

  let navDepth = 0; // how many of our own history entries currently exist beyond the floor
  let ignoreNextPopstate = false; // set right before a programmatic history.back()/go() we don't want to react to
  let reactingToPopstate = false; // true only while synchronously re-rendering in direct reaction to a real back press

  // Called at the end of every real screen change (see the render() hook
  // below). Deliberately doesn't try to tell "going deeper" apart from
  // "going back a level" - every non-floor transition just gets its own
  // pushed entry either way, and reaching the floor sheds all of them in
  // one jump. Depth can grow larger than the "true" menu depth over a long
  // session (e.g. cycling in and out of a screen a few times) - that's
  // harmless; it all collapses the moment the user reaches Home again.
  function syncBackHistory() {
    if (BACK_FLOOR_SCREENS.has(state.screen)) {
      if (navDepth > 0) {
        const steps = navDepth;
        navDepth = 0;
        ignoreNextPopstate = true;
        history.go(-steps);
      }
      return;
    }
    if (reactingToPopstate) {
      // A real back press already moved the browser to this exact real
      // entry - it was created earlier when the user first tapped into this
      // screen, so there's nothing to (re-)push. Pushing another entry here
      // would be a same-document history entry created reactively by our
      // own JS, with no direct user gesture behind this specific call -
      // browsers can treat that as trap-the-back-button abuse and skip
      // straight over it on the next real back press, landing outside the
      // app entirely. Not pushing avoids creating that entry in the first
      // place: every reachable screen already has exactly one real,
      // gesture-created entry from when the user first tapped into it, so
      // native back alone - no JS involvement - correctly walks back out
      // one level per press, all the way to the floor.
      return;
    }
    navDepth += 1;
    history.pushState({ navDepth }, '');
  }

  window.addEventListener('popstate', () => {
    if (ignoreNextPopstate) { ignoreNextPopstate = false; return; }

    // Ground truth for how deep we actually landed, read straight off the
    // entry itself - never assumed. A single native back doesn't always
    // consume exactly one of our pushed entries: fast back presses/gestures
    // can get queued by the browser and resolved together against the
    // position that existed before any of them fired, so one popstate can
    // land us several of our entries deeper than navDepth (which only ever
    // assumed "-1 per event") expects. Trusting the entry's own stored state
    // instead of our running counter keeps us in sync no matter how many
    // levels one popstate actually skipped - and stops the floor-collapse
    // below from calling history.go() an extra, unwarranted time and
    // overshooting past the real bottom of the stack (which is what was
    // exiting the app/tab a press early).
    const landedDepth = (history.state && typeof history.state.navDepth === 'number')
      ? history.state.navDepth : 0;

    if (landedDepth <= 0 && BACK_FLOOR_SCREENS.has(state.screen)) {
      // Already home, and the browser already put us at (or before) the
      // floor for real - nothing left to trap, let this one genuinely exit.
      navDepth = 0;
      return;
    }
    navDepth = landedDepth; // resync to reality before anything else touches it

    const screen = state.screen;
    if (BACK_SWALLOW_SCREENS.has(screen)) {
      // Nothing should happen. The real back press just moved the browser
      // one entry behind this screen's own entry (pushed for real when we
      // first arrived here) - that entry still exists ahead of us, untouched,
      // so history.forward() re-occupies it instead of pushState()-ing a
      // fresh one. Pushing a new entry here would be the same reactive,
      // no-gesture-behind-it pattern that caused the original back-skip bug;
      // forward() just moves within entries that already exist, so it
      // shouldn't trip the same anti-abuse heuristic. ignoreNextPopstate
      // means we don't have to do anything when that forward() lands.
      navDepth += 1;
      ignoreNextPopstate = true;
      history.forward();
      return;
    }
    if (BACK_QUIT_HANDLERS[screen]) {
      const depthBeforeHandler = navDepth;
      BACK_QUIT_HANDLERS[screen](); // may show a confirm; if confirmed this changes state.screen and calls render(), which re-arms itself via syncBackHistory()
      if (navDepth === depthBeforeHandler) {
        // Cancelled - nothing changed, so render() never got a chance to
        // re-arm. Restore the entry the back press just moved past via
        // forward() rather than pushing a new one - same reasoning as the
        // swallow-screen case above.
        navDepth += 1;
        ignoreNextPopstate = true;
        history.forward();
      }
      return;
    }
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      reactingToPopstate = true;
      backBtn.click(); // triggers that screen's own existing back handler; render() runs synchronously inside this call
      reactingToPopstate = false;
    } else {
      // No known back action on this screen - stay safe rather than stuck
      // untrapped. Same forward()-over-pushState reasoning as above.
      navDepth += 1;
      ignoreNextPopstate = true;
      history.forward();
    }
  });
