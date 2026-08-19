// Firestore progress sync: pulling/merging/pushing progress, debounced push.


  // --- Auth ---------------------------------------------------------

  let cloudSyncTimer = null;

  // --- Cloud progress sync -------------------------------------------

  // Same defensive shape-merge as loadProgress()/importProgress() below,
  // applied to whatever's stored in Firestore so a malformed or
  // partial cloud doc can't corrupt local state.
  function mergeProgressShape(parsed) {
    const merged = defaultProgress();
    merged.wordStats = normalizeWordStats(parsed.wordStats || {});
    merged.verbStats = normalizeWordStats(parsed.verbStats || {});
    merged.streak = Object.assign(merged.streak, parsed.streak || {});
    merged.conjugateStreak = Object.assign(merged.conjugateStreak, parsed.conjugateStreak || {});
    merged.lifetime = Object.assign(merged.lifetime, parsed.lifetime || {});
    merged.conjugateLifetime = Object.assign(merged.conjugateLifetime, parsed.conjugateLifetime || {});
    merged.timeAttackBest = typeof parsed.timeAttackBest === 'number' ? parsed.timeAttackBest : 0;
    merged.masteredWordsCount = typeof parsed.masteredWordsCount === 'number' ? parsed.masteredWordsCount : 0;
    merged.taLifetime = Object.assign(merged.taLifetime, parsed.taLifetime || {});
    merged.memoryBest = Object.assign({}, parsed.memoryBest || {});
    merged.memoryLifetime = Object.assign(merged.memoryLifetime, parsed.memoryLifetime || {});
    merged.streamLifetime = Object.assign(merged.streamLifetime, parsed.streamLifetime || {});
    merged.memoryClearedSizes = Object.assign({}, parsed.memoryClearedSizes || {});
    merged.settings = Object.assign(merged.settings, parsed.settings || {});
    merged.achievements = Object.assign({}, parsed.achievements || {});
    merged.dailyDoubleLastHandled = typeof parsed.dailyDoubleLastHandled === 'string' ? parsed.dailyDoubleLastHandled : null;
    merged.dailyDoubleBonusXP = typeof parsed.dailyDoubleBonusXP === 'number' ? parsed.dailyDoubleBonusXP : 0;
    merged.dailyXPGoal = typeof parsed.dailyXPGoal === 'number' && parsed.dailyXPGoal > 0 ? parsed.dailyXPGoal : DEFAULT_DAILY_XP_GOAL;
    merged.dailyStreak = Object.assign(merged.dailyStreak, parsed.dailyStreak || {});
    merged.lastActiveDate = typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : null;
    merged.recentActiveDates = Array.isArray(parsed.recentActiveDates) ? parsed.recentActiveDates.slice(-14) : [];
    merged.todaySnapshot = Object.assign({}, merged.todaySnapshot, parsed.todaySnapshot || {});
    return merged;
  }

  async function pullCloudProgress(uid) {
    try {
      const snap = await window.PalabraAuth.getUserDoc(uid);
      if (snap.exists() && snap.data().progress) {
        const data = snap.data();
        const remoteMs = data.updatedAtMs || 0;
        if (remoteMs < state.lastSyncedMs) {
          // This device has already pushed something newer than this
          // snapshot — skip it so older cloud data can't clobber more
          // recent local progress (e.g. a push from this device still
          // landing, or a slow read racing a faster write elsewhere).
          return;
        }
        state.progress = mergeProgressShape(data.progress);
        state.username = data.username || '';
        state.lastSyncedMs = remoteMs;
        state.progressDirty = false;
        // Resync the level baseline silently — this data may reflect a
        // level reached on a different device, and shouldn't replay a
        // celebration here for a milestone this device didn't just earn.
        state.lastKnownLevel = getXPLevel(state.progress).level;
        // Write straight to localStorage rather than via saveProgress(),
        // which would also schedule another cloud push — a pull should
        // never trigger a push right back, or two open tabs can end up
        // volleying stale writes at each other.
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch (e) {}
      } else {
        // Signed-in user with no cloud doc yet — this is a genuinely new
        // account (email/password signups already write a doc in
        // handleAuthSubmit before this ever runs, so in practice this only
        // fires for a first-time Google sign-in, or the rare edge case
        // that comment above already described). Same rule as email
        // signup: never carry forward whatever's currently local — it may
        // belong to a different account previously used on this device.
        state.progress = defaultProgress();
        state.progress.dailyDoubleLastHandled = todayDateString(); // same grace-day rule as email signup
        const ms = Date.now();
        await window.PalabraAuth.setUserDoc(uid, {
          progress: state.progress,
          createdAtMs: ms,
          createdAt: window.PalabraAuth.serverTimestamp(),
          updatedAtMs: ms,
          updatedAt: window.PalabraAuth.serverTimestamp(),
          platform: detectPlatform()
        });
        state.lastSyncedMs = ms;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch (e) {}
        const provider = (state.user && state.user.providerData && state.user.providerData[0] && state.user.providerData[0].providerId === 'google.com') ? 'google' : 'email';
        notifyNewSignup(state.user && state.user.email, provider);
      }
    } catch (err) {
      // Offline or blocked — fall back silently to local progress.
    }
  }

  // Debounced so a run of quick answers doesn't fire a Firestore write per
  // answer — resets on every call, actually writes once things go quiet.
  function doCloudPush() {
    if (!state.user) return Promise.resolve();
    const ms = Date.now();
    return window.PalabraAuth.setUserDoc(state.user.uid, {
      progress: state.progress,
      username: state.username || null,
      updatedAtMs: ms,
      updatedAt: window.PalabraAuth.serverTimestamp()
    }).then(() => {
      state.lastSyncedMs = ms;
      state.progressDirty = false;
    }).catch(() => {
      // Offline or blocked — local progress is still safe and will
      // retry next time saveProgress() runs.
    });
  }

  function pushCloudProgressDebounced() {
    if (!state.user) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(doCloudPush, 2500);
  }

  // Pushes any not-yet-synced local change immediately (skipping the
  // debounce wait), used before pulling fresh cloud data so a genuine
  // unsaved local change can't get clobbered by an older cloud copy. If
  // nothing has actually changed locally since the last sync, this is a
  // no-op — pushing a stale-but-unchanged copy just to "flush" would stamp
  // it with a fresh timestamp and let it wrongly win over genuinely newer
  // data from another device, which is exactly the bug this exists to avoid.
  function flushCloudSync() {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
    if (!state.progressDirty) return Promise.resolve();
    return doCloudPush();
  }
