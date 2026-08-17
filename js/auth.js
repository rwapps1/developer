// Firebase auth flow glue: sign in/up, Google sign-in, forgot password,
// session detection, platform detection, activity pinging.


  function initAuth() {
    function onReady() {
      // Picks up the result of a Google sign-in redirect, if this load is
      // the browser returning from one. No-op otherwise.
      window.PalabraAuth.getRedirectResult().catch((err) => {
        state.authError = friendlyAuthError(err);
        state.authBusy = false;
        render();
      });

      window.PalabraAuth.onAuthStateChanged(async (user) => {
        state.user = user;
        state.authBusy = false;

        if (user) {
          await pullCloudProgress(user.uid);
          pingActivity();
          if (state.screen === 'login') state.screen = 'start';
        }
        render();
      });
    }

    if (window.PalabraAuth) onReady();
    else window.addEventListener('palabra-firebase-ready', onReady, { once: true });
  }

  // Distinguishes the Android APK (Trusted Web Activity) from an installed
  // home-screen PWA from a plain browser tab — the three real channels
  // people actually use this through.
  function detectPlatform() {
    try {
      if (document.referrer && document.referrer.startsWith('android-app://')) return 'android-apk';
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'installed-pwa';
      return 'browser';
    } catch (e) {
      return 'unknown';
    }
  }

  // Lightweight "still actually playing" signal, kept separate from the
  // full progress doc (and its own updatedAt) so it isn't affected by
  // whether progress happened to change. Throttled per session so this
  // never fires more than once every couple of minutes, regardless of how
  // often it's called.
  let lastActivityPingMs = 0;
  const ACTIVITY_PING_MIN_INTERVAL_MS = 2 * 60 * 1000;
  function pingActivity() {
    if (!state.user) return;
    const now = Date.now();
    if (now - lastActivityPingMs < ACTIVITY_PING_MIN_INTERVAL_MS) return;
    lastActivityPingMs = now;
    try {
      window.PalabraAuth.setUserDoc(state.user.uid, {
        lastActiveAt: window.PalabraAuth.serverTimestamp(),
        lastActiveAtMs: now,
        platform: detectPlatform()
      }).catch(() => {});
    } catch (e) { /* ignore — this is best-effort only */ }
  }

  // Fire-and-forget ping straight to the Telegram Bot API on a genuinely
  // new account. Never awaited and never surfaces an error — a failed or
  // disabled notification must never get in the way of someone actually
  // signing up.
  function notifyNewSignup(email, method) {
    if (!TELEGRAM_CHAT_ID) return;
    try {
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: `🎉 New Palabra signup\n${email || '(no email)'}\nvia ${method || 'email'}`
        })
      }).catch(() => {});
    } catch (e) { /* ignore — notification is best-effort only */ }
  }

  function friendlyAuthError(err) {
    const code = err && err.code;
    if (code === 'palabra/timeout') return "That's taking too long to respond. Check your connection and try again — if you're testing this file locally (a file:/// address) rather than through the live site or localhost, that will also cause this.";
    if (code === 'auth/email-already-in-use') return 'That email already has an account — try signing in instead.';
    if (code === 'auth/invalid-email') return "That doesn't look like a valid email address.";
    if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return "We couldn't sign you in with that email and password. Double-check for typos, or tap \"Create account\" if you're new here.";
    if (code === 'auth/user-not-found') return 'No account found for that email — try creating one instead.';
    if (code === 'auth/too-many-requests') return 'Too many attempts — wait a moment and try again.';
    return "Something went wrong. Check your details and try again.";
  }

  // Wraps a Firebase call so a stuck network request fails after AUTH_TIMEOUT_MS
  // instead of leaving the "Please wait…" button stuck forever.
  const AUTH_TIMEOUT_MS = 15000;
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject({ code: 'palabra/timeout' }), ms))
    ]);
  }

  async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const isSignup = state.authMode === 'signup';
    // Captured now, before the render() below regenerates the form (and
    // with it, a brand new empty username input) — reading it later from
    // the DOM would read back nothing, which is exactly what was happening.
    const username = isSignup ? document.getElementById('auth-username').value.trim() : '';

    if (!email || !password) {
      state.authError = 'Enter an email and password to continue.';
      render();
      return;
    }
    if (isSignup) {
      const confirm = document.getElementById('auth-confirm').value;
      if (password !== confirm) {
        state.authError = "Passwords don't match.";
        render();
        return;
      }
    }

    state.authBusy = true;
    state.authError = '';
    state.authInfo = '';
    render();

    try {
      if (isSignup) {
        // Every new account starts from a completely clean slate. Never
        // carry forward whatever's currently in memory/localStorage — it
        // may well belong to a different account previously used on this
        // device, not this brand new one.
        state.progress = defaultProgress();
        // Give a brand new account a grace day before the Daily Double
        // popup can ever appear — someone who just signed up hasn't seen
        // a normal round yet, let alone Level/XP, so "Power up your
        // learning" would be meaningless on the very first screen they see.
        state.progress.dailyDoubleLastHandled = todayDateString();
        state.lastSyncedMs = 0;
        const cred = await withTimeout(window.PalabraAuth.signUp(email, password), AUTH_TIMEOUT_MS);
        const signupMs = Date.now();
        await withTimeout(window.PalabraAuth.setUserDoc(cred.user.uid, {
          username: username || null,
          email,
          progress: state.progress,
          createdAtMs: signupMs,
          createdAt: window.PalabraAuth.serverTimestamp(),
          updatedAtMs: signupMs,
          updatedAt: window.PalabraAuth.serverTimestamp(),
          platform: detectPlatform()
        }), AUTH_TIMEOUT_MS);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch (e) {}
        state.username = username;
        state.lastSyncedMs = signupMs;
        notifyNewSignup(email, 'email');
        // Explicit render so the menu reflects the username immediately —
        // don't rely solely on onAuthStateChanged's own render(), since its
        // timing relative to this point isn't guaranteed.
        render();
      } else {
        await withTimeout(window.PalabraAuth.signIn(email, password), AUTH_TIMEOUT_MS);
      }
      // onAuthStateChanged (in initAuth) takes it from here for sign-in.
    } catch (err) {
      state.authBusy = false;
      state.authError = friendlyAuthError(err);
      render();
    }
  }

  async function handleForgotPassword() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
      state.authError = 'Enter your email above first, then tap "Forgot password?"';
      state.authInfo = '';
      render();
      return;
    }
    state.authBusy = true;
    state.authError = '';
    state.authInfo = '';
    render();
    try {
      await withTimeout(window.PalabraAuth.resetPassword(email), AUTH_TIMEOUT_MS);
      state.authBusy = false;
      state.authInfo = `Password reset email sent to ${email} — check your inbox.`;
      render();
    } catch (err) {
      state.authBusy = false;
      state.authError = friendlyAuthError(err);
      render();
    }
  }

  function handleGoogleSignIn() {
    state.authBusy = true;
    state.authError = '';
    state.authInfo = '';
    render();
    withTimeout(window.PalabraAuth.signInWithGoogle(), AUTH_TIMEOUT_MS).catch((err) => {
      state.authBusy = false;
      state.authError = friendlyAuthError(err);
      render();
    });
    // On success the page navigates away and back; getRedirectResult()
    // in initAuth() picks up the outcome on reload.
  }
