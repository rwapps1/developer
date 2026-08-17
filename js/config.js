// App-wide config: word list filename, Telegram notify settings, storage key,
// colors, SRS intervals, achievement tables, XP formula constants, categories,
// and person labels. Constants used by only one other file live with that
// file instead (e.g. conjugation tables live in conjugation-engine.js).
// Zero dependencies — loads first.

  // ── Edit this to match the file name sitting in your repo ──
  const WORDS_FILE = 'words.xlsx';
  // ─────────────────────────────────────────────────────────

  // ── Telegram signup notification. Token/chat ID live here in the client,
  // a deliberate accepted risk: if this token ever leaks, someone could only
  // ever send messages as this one bot to this one chat — no access to the
  // app, Firestore, or any user data. If that ever happens, message
  // @BotFather → /token → PalabraGameBot to instantly issue a new one.
  // Leave TELEGRAM_CHAT_ID blank to disable — signup itself is unaffected. ──
  const TELEGRAM_BOT_TOKEN = '8716717559:AAHri5ubB6e7bTMNDuvD-AUSg_8KE8EXmHs';
  const TELEGRAM_CHAT_ID = '416291117';
  // ─────────────────────────────────────────────────────────

  // The orb loader can otherwise finish faster than it's visible on a
  // quick local load — this floor guarantees at least one full
  // pulse/sweep cycle plays before it's dismissed.
  const APP_LOADING_MIN_MS = 1750;
  const appLoadingShownAt = Date.now();

  const STORAGE_KEY = 'palabraProgress_v1';

  const COLORS = {
    green: '#2DD4BF',
    red: '#FF4D6D',
    ochre: '#FFC163',
  };

  // Simplified Leitner-style spaced repetition: box index -> days until next due
  const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
  const STREAM_CHECKPOINT_SIZE = 20; // how many stream questions between "keep going / stop" checkpoints
  const STREAM_FORMATS = ['mc', 'audio', 'type', 'cloze'];

  const ACHIEVEMENTS = {
    firstRound:  { name: 'First Steps',    desc: 'Complete your first round',              icon: '👟' },
    perfectRound:{ name: 'Perfect Round',  desc: 'Score 100% in a round',                  icon: '💯' },
    streak10:    { name: 'On Fire',        desc: 'Reach a 10-answer streak',                icon: '🔥' },
    streak25:    { name: 'Unstoppable',    desc: 'Reach a 25-answer streak',                icon: '⚡' },
    correct50:   { name: 'Word Explorer',  desc: '50 lifetime correct answers',             icon: '🧭' },
    correct200:  { name: 'Word Master',    desc: '200 lifetime correct answers',            icon: '🎓' },
    masteredWords25:  { name: 'Well Learned',       desc: '25 words reached box 6 (mastered)',   icon: '🌟' },
    masteredWords100: { name: 'Vocabulary Vault',   desc: '100 words reached box 6 (mastered)',  icon: '🏦' },
    bigRound:    { name: 'Marathon',       desc: 'Complete a round of 50 or more words',    icon: '🏃' },
    allWords:    { name: 'Completionist',  desc: 'Quiz your entire word list in one round', icon: '📚' },
    timeAttack10: { name: 'Quickdraw',      desc: 'Score 10 in a single Time Attack round',  icon: '🎯' },
    timeAttack25: { name: 'Speed Runner',   desc: 'Score 25 in a single Time Attack round',  icon: '🚀' },
    timeAttack50: { name: 'Lightning Round',desc: 'Score 50 in a single Time Attack round',  icon: '🌪️' },
    timeAttack100:{ name: 'Blur',           desc: 'Score 100 in a single Time Attack round', icon: '👑' },
    memoryFirstWin: { name: 'Board Cleared', desc: 'Complete your first Memory Match board',        icon: '🧩' },
    memoryPerfect:  { name: 'Perfect Recall',desc: 'Beat your own best on a grid size you\u2019ve played before',   icon: '🧠' },
    memoryFast:     { name: 'Quick Fingers', desc: 'Clear a 12-pair board in under 90 seconds',     icon: '💨' },
    timeAttackNewBest:    { name: 'Personal Best',  desc: 'Beat your own Time Attack high score',            icon: '🏅' },
    timeAttackFlawless:   { name: 'Flawless',       desc: 'No wrong answers in a Time Attack round',         icon: '✨' },
    timeAttackStreak15:   { name: 'Dialed In',      desc: '15 correct in a row in a Time Attack round',      icon: '🔆' },
    timeAttackStreak30:   { name: 'In The Zone',    desc: '30 correct in a row in a Time Attack round',      icon: '🌊' },
    timeAttackCorrect100: { name: 'Sharpshooter',   desc: '100 lifetime correct answers in Time Attack',     icon: '🎖️' },
    timeAttackCorrect500: { name: 'Marksman',       desc: '500 lifetime correct answers in Time Attack',     icon: '🏆' },
    memoryFast6:     { name: 'Swift Sweep',    desc: 'Clear a 6-pair board in under 30 seconds',    icon: '⏩' },
    memoryFast8:     { name: 'Rapid Recall',   desc: 'Clear an 8-pair board in under 50 seconds',   icon: '🌀' },
    memoryBoards10:  { name: 'Regular Player', desc: 'Clear 10 lifetime Memory Match boards',       icon: '🗂️' },
    memoryBoards50:  { name: 'Memory Veteran', desc: 'Clear 50 lifetime Memory Match boards',       icon: '🎗️' },
    memoryAllSizes:  { name: 'Full House',     desc: 'Clear a board on all three grid sizes',       icon: '🎲' },
    conjugateFirstRound: { name: 'Verb Novice',    desc: 'Complete your first Conjugate round',   icon: '🌱' },
    conjugateStreak5:    { name: 'Getting Started', desc: 'Reach a 5-answer Conjugate streak',    icon: '🌿' },
    conjugateCorrect50:  { name: 'Verb Builder',    desc: '50 lifetime correct conjugations',      icon: '🧱' },
    conjugatePerfect:    { name: 'Grammar Master', desc: 'Score 100% in a Conjugate round',        icon: '📗' },
    conjugateStreak15:   { name: 'Fluent',         desc: 'Reach a 15-answer Conjugate streak',     icon: '💬' },
    conjugateStreak30:   { name: 'Conjugation Pro', desc: 'Reach a 30-answer Conjugate streak',    icon: '🗣️' },
    conjugateBigRound:   { name: 'Verb Marathon',   desc: 'Complete a round of 50 or more verbs',  icon: '🛤️' },
    conjugateCorrect200: { name: 'Grammar Grinder', desc: '200 lifetime correct conjugations',     icon: '⚙️' },
    conjugateStreak50:   { name: 'Grammar Legend',  desc: 'Reach a 50-answer Conjugate streak',    icon: '🏛️' },
    streamFirst:            { name: 'First Stream',      desc: 'Complete your first Stream checkpoint',                          icon: '🚦' },
    streamCheckpoints10:    { name: 'In The Flow',       desc: 'Reach 10 lifetime Stream checkpoints',                           icon: '🔁' },
    streamCheckpoints50:    { name: 'Deep Diver',        desc: 'Reach 50 lifetime Stream checkpoints',                           icon: '🤿' },
    streamPerfectCheckpoint:{ name: 'Clean Sweep',       desc: 'A perfect checkpoint block, no mistakes',                        icon: '🧹' },
    streamAllFormats:       { name: 'Triple Threat',     desc: 'Answer correctly in choice, listen, and type — all in one session', icon: '🎛️' },
    streamAllFormatsQuad:   { name: 'Quadruple Threat',  desc: 'Answer correctly in choice, listen, type, and fill-in-the-blank — all in one session', icon: '🎯' },
    streamAudio25:          { name: 'Good Ear',          desc: '25 lifetime correct audio answers in Stream',                    icon: '🎧' },
    streamStreak40:         { name: 'Locked In',         desc: 'A 40-answer streak within a single stream',                      icon: '🔒' },
    streamCorrect100:       { name: 'Stream Regular',    desc: '100 lifetime correct answers in Stream',                         icon: '🗺️' },
    streamCorrect500:       { name: 'Stream Veteran',    desc: '500 lifetime correct answers in Stream',                         icon: '⛰️' },
    streamMarathon:         { name: 'Marathon Session',  desc: '5 checkpoints in one sitting, no stopping',                      icon: '🏕️' },
  };

  // Groups the flat ACHIEVEMENTS registry by which game each badge belongs to,
  // using the id prefix convention already in place (timeAttack*, memory*, conjugate*).
  // Anything with no game-specific prefix belongs to Quiz (which Categories shares).
  const ACHIEVEMENT_GROUPS = [
    { id: 'stream', name: 'Stream', icon: '🌊', color: 'rgba(255,193,99,0.18)', prefix: 'stream' },
    { id: 'quiz', name: 'Quiz', icon: '🔤', color: 'rgba(255,107,74,0.18)', prefix: null },
    { id: 'timeattack', name: 'Time Attack', icon: '⏱', color: 'rgba(45,212,191,0.18)', prefix: 'timeAttack' },
    { id: 'memory', name: 'Memory Match', icon: '🧩', color: 'rgba(217,70,239,0.18)', prefix: 'memory' },
    { id: 'conjugate', name: 'Conjugate', icon: '📖', color: 'rgba(52,211,153,0.18)', prefix: 'conjugate' },
  ];

  // --- XP & Level ---------------------------------------------------------
  // XP and Level are purely derived from existing lifetime counters at
  // render time — nothing new is stored for them, so there's no shape-merge
  // work needed and nothing that can drift out of sync between devices.
  // Every ingredient below is a monotonic lifetime counter or a best-ever
  // record, never a value that can drop — so XP (and therefore Level) only
  // ever goes up.
  const XP_LEVEL_BASE_SPAN = 100;    // XP needed to clear Level 1
  const XP_LEVEL_GROWTH = 1.15;      // each level needs 15% more than the last
  const XP_PER_QUIZ_CORRECT = 1;
  const XP_PER_CONJUGATE_CORRECT = 1;
  const XP_PER_TIMEATTACK_CORRECT = 0.5; // faster-paced mode, so a lower per-answer rate keeps XP/minute roughly even with Quiz
  const XP_MEMORY_BOARD = { '6': 10, '8': 15, '12': 25 }; // bigger board, bigger reward
  const XP_MEMORY_LEGACY = 15; // flat fallback for boards cleared before per-size tracking existed
  const XP_PER_BEST_STREAK_POINT = 2;
  const XP_PER_ACHIEVEMENT = 20;

  // file id (matches "categories-{id}.xlsx" in the repo) -> display name + icon
  // kept in alphabetical order by name, which is also the order the tiles render in
  const CATEGORIES = [
    { id: 'animals',        name: 'Animals',          icon: '🐾' },
    { id: 'bodyparts',      name: 'Body Parts',       icon: '🖐️' },
    { id: 'clothing',       name: 'Clothing',         icon: '👕' },
    { id: 'colours',        name: 'Colours',          icon: '🎨' },
    { id: 'dailyverbs',     name: 'Daily Verbs',      icon: '🏃' },
    { id: 'daysandmonths',  name: 'Days and Months',  icon: '📅' },
    { id: 'emotions',       name: 'Emotions',         icon: '😊' },
    { id: 'family',         name: 'Family',           icon: '👪' },
    { id: 'foodanddrink',   name: 'Food and Drink',   icon: '🍽️' },
    { id: 'greetings',      name: 'Greetings',        icon: '👋' },
    { id: 'house',          name: 'House',            icon: '🏠' },
    { id: 'numbers',        name: 'Numbers',          icon: '🔢' },
    { id: 'questionwords',  name: 'Question Words',   icon: '❓' },
    { id: 'transport',      name: 'Transport',        icon: '🚗' },
    { id: 'weather',        name: 'Weather',          icon: '🌦️' },
  ];

  // ---- Conjugation engine (present tense, indicative) ----
  // Person order: 0=yo, 1=tú, 2=él/ella/usted, 3=nosotros, 4=vosotros, 5=ellos/ellas/ustedes
  const PERSON_LABELS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
