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

  // True while a forward()/go() *we* issued (not the user) hasn't finished
  // landing yet. forward()/go() are asynchronous - the popstate they cause
  // doesn't fire synchronously, so there's a real window between "we called
  // it" and "it actually resolved" during which the app is still usable. If
  // a genuine user gesture triggers syncBackHistory() -> pushState() inside
  // that window, the two navigations race: depending on timing, our
  // in-flight forward() can resolve *after* the fresh pushState(), silently
  // reordering the stack. That race is what produced the confirmed bug
  // where a second "Quit" attempt (after cancelling the first) sent the
  // user out of the app instead of showing the confirm dialog again -
  // ignoreNextPopstate + forward() from the cancelled attempt was still
  // in flight when the second attempt's real state change tried to push.
  // Fix: any push that would happen while one of our own navigations is
  // still settling gets queued instead of racing it, and fires the instant
  // the pending navigation actually lands (see ownNavigation below).
  let ownNavigationPending = false;
  let queuedPushAfterSettle = false;

  // Every place in this file that used to do a bare
  // `ignoreNextPopstate = true; history.forward();` (or history.go()) now
  // routes through here instead, so syncBackHistory() has a reliable signal
  // for "don't push yet, one of our own navigations hasn't landed."
  function ownNavigation(steps) {
    ownNavigationPending = true;
    ignoreNextPopstate = true;
    const settle = () => {
      window.removeEventListener('popstate', settle);
      ownNavigationPending = false;
      if (queuedPushAfterSettle) {
        queuedPushAfterSettle = false;
        navDepth += 1;
        history.pushState({ navDepth }, '');
      }
    };
    // ignoreNextPopstate stops the main popstate listener below from
    // treating this as a user-initiated back press, but this dedicated
    // listener still needs to observe the same event so ownNavigationPending
    // clears at the real moment the navigation lands, not a guessed delay.
    window.addEventListener('popstate', settle);
    if (steps === 1) history.forward(); else history.go(steps);
  }

  // True (via a depth counter, not a plain boolean - see below) for the
  // duration of a setTimeout/setInterval callback that auto-advances the
  // screen with no user tap behind it (round-end auto-advance off
  // Celebrate, checkpoint auto-continue, level-up auto-advance, a mode's
  // own round-end timer such as Time Attack's countdown expiry or Memory
  // Match's post-match delay calling into showCelebration). Any render()/
  // pushState() that happens while this is active gets downgraded to
  // replaceState() - see syncBackHistory() below. pushState() fired from
  // inside a timer callback has no trusted user gesture behind it, and the
  // browser can (and, per the confirmed live bug, does) silently skip that
  // entry on the very next real back press: from the browser's perspective
  // an untrusted-context pushState looks identical to a page trying to trap
  // the back button. That's exactly what was happening - Celebrate -> Result
  // were both reached via this same timer-driven path, but only Result
  // being a real (non-swallow) screen made the skipped entry actually
  // matter, so back on Result fell through to whatever was two entries back
  // instead of one and exited the app. replaceState() sidesteps the problem
  // entirely: it never adds a new entry for the anti-abuse heuristic to
  // skip. The trade-off - the screen being left behind has its entry
  // overwritten rather than kept underneath - is fine here because every
  // caller wrapping with this flag is leaving a swallow screen (Celebrate/
  // Level-Up/Stream-Checkpoint), where back already did nothing, so there
  // was never a reachable destination on that entry to begin with.
  let timerAdvanceDepth = 0; // counter, not boolean - see runAsTimerAdvance

  // Wrap a setTimeout/setInterval callback's body in this so any render()
  // it triggers - directly, or indirectly by calling into other functions
  // that themselves call render() - gets the replaceState() treatment
  // instead of a trap-able pushState(). Use this in every timer callback
  // that changes state.screen without a user tap having caused it.
  //
  // Uses a depth counter rather than a simple true/false flag because these
  // calls nest: Time Attack's countdown timer calls endTimeAttack(), which
  // calls showCelebration(), which itself wraps its own render() the same
  // way. A boolean would have the inner call's `finally` clear the flag
  // back to false while the outer timer callback is still executing,
  // silently un-arming protection for anything the outer callback does
  // after the inner call returns. The counter only reaches zero - "fully
  // unwound, no timer context active" - once every nested call has
  // finished, regardless of nesting depth or order.
  function runAsTimerAdvance(fn) {
    timerAdvanceDepth += 1;
    try {
      fn();
    } finally {
      timerAdvanceDepth -= 1;
    }
  }

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
        ownNavigation(-steps);
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
    if (ownNavigationPending) {
      // One of our own forward()/go() calls hasn't landed yet (see
      // ownNavigation above) - pushing now would race it and can silently
      // corrupt the stack order. Defer this push until that navigation
      // actually settles.
      queuedPushAfterSettle = true;
      return;
    }
    navDepth += 1;
    if (timerAdvanceDepth > 0) {
      // No trusted user gesture behind this transition - see
      // runAsTimerAdvance() above. replaceState() instead of pushState() so
      // there's no untrusted entry for the browser to silently skip.
      history.replaceState({ navDepth }, '');
    } else {
      history.pushState({ navDepth }, '');
    }
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
      // shouldn't trip the same anti-abuse heuristic.
      navDepth += 1;
      ownNavigation(1);
      return;
    }
    if (BACK_QUIT_HANDLERS[screen]) {
      // The quit-confirm dialog is an in-app overlay (state.quitConfirmMode
      // + a render()ed panel - see game-quiz.js), not a native confirm().
      // That fixes the ORIGINAL "quit, cancel, quit again" bug: a native
      // dialog sits outside the app's own DOM/history, so a hardware back
      // press while it was open got handled by the WebView/OS chrome
      // directly and never reached this listener at all.
      //
      // Confirmed live (2026-08) that the first attempt at this branch
      // introduced a WORSE bug: it used history.replaceState() to mark
      // "overlay open" on the current entry, on both the opening press and
      // (originally) the cancelling press. replaceState() doesn't create a
      // new entry, but it does overwrite whatever was already sitting at
      // that position - and the entry sitting there by the time a back
      // press reaches this branch is never one of ours, it's the real
      // entry the browser just walked back to (the previous site, or the
      // app's own earlier screen). A couple of replaceState() calls in a
      // row was silently eating through genuine prior history, and once
      // there was nothing legitimate left underneath, the next back press
      // had nowhere to land and fell through to actually exiting - which
      // is exactly the symptom reported (repeated back presses eventually
      // left the site, in both a normal tab and Incognito).
      //
      // Fix: never call pushState() OR replaceState() anywhere in this
      // branch. The overlay's open/closed state lives ENTIRELY in
      // state.quitConfirmMode (plain in-memory app state, re-rendered on
      // every popstate the normal way) - it never needs its own history
      // entry, open or closed, because it isn't a distinct navigable
      // screen, just a transient UI layer on top of the current one.
      //   - Opening (back press, overlay not yet open): the browser has
      //     already moved one entry back for real. Restore it with
      //     forward() - same untouched-re-occupy pattern as the swallow-
      //     screen branch above - then just set the in-memory flag and
      //     render(). Nothing in history is created OR overwritten.
      //   - Cancelling (back press, overlay already open): identical -
      //     restore the entry with forward(), clear the flag, render().
      //     The entry underneath was never touched by either press, so
      //     however many times this cycles, real history stays intact.
      // Tapping the on-screen Quit button is unaffected - that path calls
      // showQuitConfirm() directly (not via popstate), so its render() goes
      // through the normal non-reacting path and legitimately pushes a
      // real, trusted entry, exactly as before.
      if (state.quitConfirmMode === screen) {
        state.quitConfirmMode = null;
      } else {
        state.quitConfirmMode = screen;
      }
      // reactingToPopstate=true makes syncBackHistory() (called inside
      // render()) take its no-op path - state.screen isn't changing, only
      // the in-memory overlay flag, so there is nothing to push or replace
      // in history for this render() at all.
      reactingToPopstate = true;
      render();
      reactingToPopstate = false;
      navDepth += 1;
      ownNavigation(1);
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
      ownNavigation(1);
    }
  });
