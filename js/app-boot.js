// Final wiring: the Enter-key handler, initAuth()/loadFromRepo() calls,
// service worker registration, tab-visibility resync, and keyboard-safe
// scrolling. Loads dead last - loadFromRepo() calls render() synchronously
// on its very first line, which requires every view file and the render()
// dispatcher to already be loaded.


  // Single, stable listener for advancing on Enter from the feedback screen.
  // (Installed once — not re-created per render — so it can never stack up.)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    // Ignore an Enter whose target is a <button>. Activating a button by
    // tap/click on Android Chrome can synthesize an Enter keydown as part
    // of button activation - if that lands here while state.checked is
    // already true (e.g. a tap-to-answer True/False or multiple-choice
    // question), it would fire a second, immediate nextQuestion() on top of
    // the button's own handler, skipping the feedback the player just
    // earned. Genuine "advance on Enter" only ever comes from the keyboard
    // while focus is on the answer text input or the page body, never from
    // a button, so excluding button targets is safe.
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (state.screen === 'quiz' && state.checked) {
      nextQuestion();
    } else if (state.screen === 'conjugate' && state.conjugateChecked) {
      nextConjugateQuestion();
    }
  });

  // Landing-page demo (/new) hands off here with ?signup=1 so the person
  // continuing from their demo round lands on the Create Account tab, not
  // Sign In — see new/js/demo-boot.js's goToSignupFromDemo(). Only affects
  // which tab is pre-selected; if they already have a session, initAuth()
  // below still takes them straight to the hub regardless. Stripped from
  // the URL right away so refreshing this tab later doesn't keep forcing
  // signup mode.
  if (new URLSearchParams(window.location.search).get('signup') === '1') {
    state.authMode = 'signup';
    window.history.replaceState(null, '', window.location.pathname);
  }

  // Checks for an existing signed-in session and decides login vs hub.
  // Independent of the word/verb list loading below — vocab data isn't
  // user-specific, so both can happen in parallel.
  initAuth();

  loadFromRepo();

  // Verbs, categories, and everything else now come from the single sheet
  // loaded above — parseRows() derives state.verbPairs automatically as
  // soon as it resolves, no separate fetch needed (see loadVerbsFile's own
  // comment for the still-needed synchronous fallback it provides).

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        // Not fatal — the app still works online without it
      });
    });
  }

  // Flags that progress may be stale after using the app elsewhere (another
  // tab, another device). If already on the hub, syncs immediately; if not,
  // renderStart() picks the flag up as soon as the hub is next shown —
  // covers both "switched tabs while on the hub" and "switched tabs, then
  // navigated back to the hub afterward".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user) {
      state.needsCloudSync = true;
      if (state.screen === 'start') render();
    }
  });

  // ---- Keyboard-safe scrolling ----------------------------------------
  // interactive-widget=resizes-content (viewport meta, see <head>) makes
  // Chrome actually shrink the page around the on-screen keyboard instead
  // of just overlaying it — but that alone only guarantees the *focused*
  // input scrolls into view, not whatever comes after it. On a typed-answer
  // screen (Quiz, Conjugate, Time Attack) or the login form, that's the
  // Check/Sign in/Save button, and it can still end up just out of sight
  // below a short keyboard-shrunk viewport, worse with Chrome's own
  // autofill accessory bar eating extra height on top of the keyboard.
  //
  // Rather than hard-coding this per screen, walk forward from whatever
  // input is focused (through siblings, then up to the parent's siblings
  // if it runs out, stopping at #app) until a primary/secondary action
  // button is found, and bring that into view instead of just the input.
  // Works for every current typed-input screen and any future one without
  // needing to be wired up again each time.
  function findNextActionButton(el, hops) {
    if (!el || hops > 8) return null;
    let node = el;
    while (node) {
      const sib = node.nextElementSibling;
      if (sib) {
        if (sib.tagName === 'BUTTON' && (sib.classList.contains('btn-primary') || sib.classList.contains('btn-secondary'))) return sib;
        const nested = sib.querySelector && sib.querySelector('.btn-primary, .btn-secondary');
        if (nested) return nested;
        node = sib;
      } else {
        node = node.parentElement;
        if (!node || node.id === 'app') return null;
      }
    }
    return null;
  }

  function scrollKeyboardTargetIntoView(active) {
    if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;
    const target = findNextActionButton(active, 0) || active;
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Two independent triggers, deliberately redundant, since a single
  // heuristic already failed once here:
  // 1) visualViewport resize — fires when the keyboard genuinely changes
  //    the visible area. Under interactive-widget=resizes-content the
  //    layout viewport shrinks together with the visual one, so there's
  //    no reliable "gap" to gate on — just react to any resize while an
  //    input is focused rather than trying to guess whether it was the
  //    keyboard specifically.
  // 2) focusin, on a longer delay — a fallback in case the resize event
  //    fires before the keyboard animation has actually settled, or
  //    doesn't fire as expected on a given device/Chrome version.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      setTimeout(() => scrollKeyboardTargetIntoView(document.activeElement), 80);
    });
  }
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      setTimeout(() => scrollKeyboardTargetIntoView(e.target), 350);
    }
  });
