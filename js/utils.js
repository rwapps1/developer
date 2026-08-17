// General-purpose helpers with no dependency on state or any other app file:
// string/array utilities, matching/answer-checking, weighted sampling, and
// the esc() HTML-escaping helper used throughout the render files.


  function normalize(str) {
    return str.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function splitAnswers(cell) {
    return cell.toString().split(/[/;,]/).map(s => s.trim()).filter(Boolean);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function wordKey(pair) {
    return normalize(pair.es) + '::' + normalize(pair.en);
  }

  // Anywhere a field is being displayed as a single word - a prompt, or a
  // "Correct answer:" reveal - rather than checked against, only the first
  // slash-separated alternative should show. Matching still checks all of
  // them via splitAnswers(); this is display-only.
  function primaryText(field) {
    return splitAnswers(field)[0] || '';
  }

  // The field a question's typed/chosen answer is actually checked
  // against. Cloze always tests the Spanish word itself, regardless of
  // the direction randomly assigned to that question - there's no
  // "translate this" step, just "what word is missing".
  function targetFieldFor(current) {
    if (current.format === 'cloze') return current.es;
    return current.direction === 'es-en' ? current.en : current.es;
  }

  // Finds pair.es (or its regular plural) inside pair.sentence and
  // returns the surrounding text split around it, ready to render with a
  // blank in place of the match. Mirrors the exact matching logic used to
  // author and validate the Sentence column, so anything that passed
  // validation there is guaranteed to blank cleanly here. Returns null if
  // the word truly isn't found (used both to disable cloze for a row at
  // load time and, defensively, again at render time).
  function findClozeBlank(pair) {
    if (!pair.sentence) return null;
    const es = pair.es;
    const forms = [es];
    if (/[aeiouáéíóú]$/i.test(es)) forms.push(es + 's');
    else if (/ón$/i.test(es)) forms.push(es.slice(0, -2) + 'ones');
    else if (/z$/i.test(es)) forms.push(es.slice(0, -1) + 'ces');
    else forms.push(es + 'es');
    const boundary = 'a-zA-ZáéíóúñÁÉÍÓÚÑ';
    for (const form of forms) {
      const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![${boundary}])${escaped}(?![${boundary}])`, 'i');
      const match = pair.sentence.match(re);
      if (match) {
        const idx = match.index;
        return {
          before: pair.sentence.slice(0, idx),
          matched: match[0],
          after: pair.sentence.slice(idx + match[0].length),
        };
      }
    }
    return null;
  }

  // The word pool every quiz-family function should read from: the active
  // category's words if one is selected, otherwise the main pool (which
  // already excludes conjugation-only verbs - see isMainPoolEligible).
  function activePairs() {
    return state.activeCategory ? state.categoryPairs : state.mainPool;
  }

  // The pool for Sentences mode - only main-pool words with an actual
  // usable sentence (findClozeBlank succeeds). Recomputed from state.mainPool
  // each time rather than cached, so it automatically tracks new sentences
  // added to words.xlsx without any extra wiring.
  function sentencePairs() {
    return state.mainPool.filter(p => findClozeBlank(p));
  }

  function getWeight(pair) {
    const stats = state.progress.wordStats[wordKey(pair)];
    const now = Date.now();
    if (!stats) return 12; // never seen - high priority
    const overdueMs = now - (stats.nextDue || 0);
    if (overdueMs >= 0) {
      // due or overdue - the longer overdue, the higher the priority
      const overdueDays = overdueMs / 86400000;
      return 6 + Math.min(overdueDays, 12) * 1.5;
    }
    // not yet due - small residual chance, higher the closer it is to becoming due
    const daysUntilDue = -overdueMs / 86400000;
    return Math.max(0.2, 3 / (1 + daysUntilDue * 2));
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const temp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = temp;
      }
    }
    return dp[n];
  }

  function isCloseMatch(userNorm, ansNorm) {
    if (!userNorm || !ansNorm) return false;
    if (userNorm === ansNorm) return true;
    const dist = levenshtein(userNorm, ansNorm);
    const len = Math.max(userNorm.length, ansNorm.length);
    const threshold = Math.max(1, Math.round(len * 0.4));
    return dist <= threshold;
  }

  function isAnswerCorrect(input, targetField) {
    const userNorm = normalize(input);
    if (userNorm.length === 0) return false;
    const acceptable = splitAnswers(targetField).map(normalize);
    if (acceptable.includes(userNorm)) return true;
    return acceptable.some(ans => isCloseMatch(userNorm, ans));
  }

  function weightedSampleWithoutReplacement(items, weightFn, count) {
    const pool = items.map(item => ({ item, weight: Math.max(weightFn(item), 0.0001) }));
    const result = [];
    while (result.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
      let r = Math.random() * totalWeight;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= pool[idx].weight;
        if (r <= 0) break;
      }
      result.push(pool[idx].item);
      pool.splice(idx, 1);
    }
    return result;
  }

  function weightedPickOne(items, weightFn, excludeKey) {
    let pool = items;
    if (excludeKey && items.length > 1) {
      const filtered = items.filter(p => wordKey(p) !== excludeKey);
      if (filtered.length > 0) pool = filtered;
    }
    const weights = pool.map(p => Math.max(weightFn(p), 0.0001));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Daily Double ---------------------------------------------------
  // Local device date, plain YYYY-MM-DD string — deliberately not a
  // timestamp, so it's a simple equality check rather than fiddly
  // midnight-boundary math. Stored on the synced progress object so a
  // Skip/Play decision follows the account across devices, same day.
  function todayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
