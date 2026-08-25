// The single global state object (~90 fields). Depends on progress-xp.js
// (calls loadProgress() at construction time).


  const state = {
    screen: 'login', // login | start | quiz | result
    user: null,
    username: '',
    editingUsername: false,
    needsCloudSync: false,
    lastSyncedMs: 0,
    progressDirty: false,
    authMode: 'signin', // signin | signup
    authError: '',
    authInfo: '',
    authBusy: false,
    loading: true,
    fetchFailed: false,
    showUpload: false,
    showMenu: false,
    pairs: [],
    mainPool: [],
    error: '',
    hasHeader: true,
    fileName: '',
    rawRows: null,
    questions: [],
    index: 0,
    input: '',
    checked: false,
    wasCorrect: false,
    results: [],
    newBestThisRound: false,
    progress: loadProgress(),
    effectiveAnswerMode: 'type',
    currentOptions: null,
    selectedOption: null,
    autoAdvanceTimer: null,
    celebrateTimer: null,
    celebrateVariant: null, // 'perfect' | 'finished'
    celebrateNext: null,    // which screen to land on once the celebration ends
    lastKnownLevel: null,   // session baseline for detecting a level-up; null until first checkLevelUp() call
    pendingLevelUp: null,   // set the instant a level-up is detected, shown once results are left
    levelUpNextFn: null,    // what to do once the Level Up screen is dismissed
    levelUpTimer: null,
    queuedAchievementToasts: [],
    lastFlippedIndex: -1,
    lastWasTypo: false,
    resultMode: 'round', // 'round' | 'timeattack'
    isDailyDoubleRound: false,
    isStreamRound: false,
    lastRoundWasStream: false, // survives into the results screen (isStreamRound itself is cleared before then) so "Play again" knows to restart a stream, not a normal round
    lastRoundWasSentences: false, // same idea as lastRoundWasStream, but for Sentences mode - Quiz and Sentences share the same results screen, so this is how "Play again" / "Change settings" know which one to restart
    streamCheckpointCount: 0, // answers since the last checkpoint (0-9), resets each checkpoint
    streamSessionStreak: 0,      // correct-in-a-row within THIS stream session only (Locked In) — same session-only pattern as taStreak
    streamSessionCheckpoints: 0, // checkpoints reached in one continuous sitting, without stopping (Marathon Session)
    streamFormatsCorrect: {},    // which formats (mc/audio/type/cloze) have had a correct answer this session (Triple Threat only requires mc/audio/type)
    streamFormatBag: [],         // shuffled queue of Stream formats still to be dealt this session - refilled with a fresh shuffle of all 6 formats whenever it empties (see buildStreamBatch in word-selection.js), so every 6 questions covers all 6 formats but in unpredictable order rather than a fixed rotation. Reset at the start of each new stream.
    streamRecentWordKeys: [],    // rolling window of the last STREAM_RECENT_WORD_WINDOW word keys asked in this stream, any format - buildStreamBatch avoids repeating one of these if a fresher option exists in the box-preference tier it's drawing from, so a word that happens to be one of very few (or the only one) eligible for a format's preferred box doesn't get handed out over and over. Reset at the start of each new stream.
    tfClaimEn: '',        // the English text shown as the True/False claim for the current question
    tfIsTrue: false,      // whether that claim is actually correct
    tfSessionStreak: 0,   // consecutive correct True/False answers within this stream session — resets on a wrong True/False answer only (Snap Judgment)
    scrambleBank: [],     // [{text, origIndex}] — current scramble question's words, in shuffled display order
    scramblePlaced: [],   // array of origIndex values, in the order the player has tapped them so far
    scrambleSessionStreak: 0, // consecutive correct Scramble answers within this stream session — resets on a wrong Scramble answer only (Word Order)
    taActive: false,
    taScore: 0,
    taStreak: 0,
    taTimeLeft: 60,
    taEndTime: 0,
    taTimerHandle: null,
    taFlashTimer: null,
    taCurrentQuestion: null,
    taCurrentOptions: null,
    taInput: '',
    taIsNewBest: false,
    memoryTiles: [],
    memoryFlipped: [],
    memoryMatchedCount: 0,
    memoryTotalPairs: 0,
    memoryMoves: 0,
    memoryBusy: false,
    memoryStartTime: 0,
    memorySeconds: 0,
    memoryTimerHandle: null,
    memoryFlipTimer: null,
    memoryIsNewBest: false,
    memoryJustFlipped: [],
    memoryReacting: [],
    activeCategory: null,
    categoryPairs: [],
    categoryLoading: false,
    categoryError: '',
    verbPairs: [],
    verbsLoaded: false,
    verbsLoading: false,
    verbsError: '',
    conjugateQuestions: [],
    conjugateIndex: 0,
    conjugateResults: [],
    conjugateInput: '',
    conjugateChecked: false,
    conjugateWasCorrect: false,
    conjugateCurrentOptions: null,
    conjugateSelectedOption: null,
    conjugateNewBestStreak: false,
    conjugateLastWasTypo: false,
    achievementGroup: null,
    quitConfirmMode: null, // null | 'quiz' | 'timeattack' | 'memory-play' | 'conjugate' — which mode's in-app quit-confirm overlay is showing, if any. Replaces window.confirm(): a native dialog isn't part of the DOM/history the app controls, so a hardware back press while it's open is handled by the OS/WebView chrome itself rather than reaching this app's own popstate handling — confirmed as the cause of the "quit, cancel, quit again" back-button bug. An in-app overlay driven by this field is just another render() state change, so it participates in the same trusted-gesture history logic as everything else.
  };
