// words.xlsx fetching/parsing, category tagging, and the fallback
// file-upload handler.


  function extractPairsFromRows(rows, skipHeader) {
    const startIdx = skipHeader ? 1 : 0;
    const cleaned = [];
    const seenEs = new Set();
    const dupes = [];
    const unknownCats = new Set();
    const badSentences = [];
    let skipped = 0;
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const es = (row[0] ?? '').toString().trim();
      const en = (row[1] ?? '').toString().trim();
      const note = (row[2] ?? '').toString().trim();
      const category = (row[3] ?? '').toString().trim();
      const sentence = (row[4] ?? '').toString().trim();
      const sentenceTranslation = (row[5] ?? '').toString().trim();
      if (!es && !en) continue; // fully blank row - not worth flagging
      if (!es || !en) { skipped++; continue; }
      const esKey = es.toLowerCase();
      if (seenEs.has(esKey)) dupes.push(es);
      seenEs.add(esKey);
      if (category) {
        category.split(',').map(c => c.trim()).filter(Boolean).forEach(tag => {
          if (tag !== 'conjugation' && !CATEGORIES.some(c => c.id === tag)) unknownCats.add(tag);
        });
      }
      const pair = { es, en, note, category, sentence, sentenceTranslation };
      if (sentence && !findClozeBlank(pair)) {
        // A sentence that doesn't actually contain its own target word
        // (typo, wrong row, edited word without updating the sentence)
        // would either break rendering or silently reveal nothing to
        // blank - drop it rather than risk either, this word just isn't
        // cloze-eligible until the sheet is fixed. Its translation goes
        // with it, so a disabled cloze row never carries a stale/orphaned
        // translation with no sentence to pair it with.
        badSentences.push(es);
        pair.sentence = '';
        pair.sentenceTranslation = '';
      }
      cleaned.push(pair);
    }
    if (skipped > 0) console.warn(`Palabra: skipped ${skipped} row(s) with only one of Spanish/English filled in.`);
    if (dupes.length > 0) console.warn(`Palabra: duplicate Spanish word(s) in the sheet: ${dupes.join(', ')}`);
    if (unknownCats.size > 0) console.warn(`Palabra: unrecognized category tag(s): ${[...unknownCats].join(', ')}`);
    if (badSentences.length > 0) console.warn(`Palabra: sentence doesn't contain its own word, cloze disabled for: ${badSentences.join(', ')}`);
    return cleaned;
  }

  // A pair's Category cell can hold several comma-separated tags (e.g.
  // "conjugation,dailyverbs"). These two helpers are the single place that
  // knows how to read that.
  function pairCategories(pair) {
    return pair.category ? pair.category.split(',').map(c => c.trim()).filter(Boolean) : [];
  }

  function pairHasCategory(pair, categoryId) {
    return pairCategories(pair).includes(categoryId);
  }

  // A word stays out of normal Quiz/Time Attack/Stream/Daily Double
  // practice only if "conjugation" is its *only* tag - a word tagged both
  // conjugation and a normal category (several dailyverbs entries are
  // both) still shows up in ordinary practice via that other tag.
  function isMainPoolEligible(pair) {
    const cats = pairCategories(pair);
    if (cats.length === 0) return true;
    return cats.some(c => c !== 'conjugation');
  }

  function parseRows(rows, skipHeader) {
    const cleaned = extractPairsFromRows(rows, skipHeader);
    if (cleaned.length === 0) {
      state.error = 'No word pairs found. Make sure column A has Spanish and column B has English.';
      state.pairs = [];
      state.mainPool = [];
      state.verbPairs = [];
      state.verbsLoaded = false;
      state.verbsError = '';
    } else {
      state.error = '';
      state.pairs = cleaned;
      state.mainPool = cleaned.filter(isMainPoolEligible);
      state.verbPairs = cleaned.filter(p => pairHasCategory(p, 'conjugation'));
      state.verbsLoaded = state.verbPairs.length > 0;
      state.verbsError = state.verbPairs.length === 0
        ? 'No verbs found. Make sure some rows in words.xlsx have "conjugation" in the Category column.'
        : '';
      state.verbsLoading = false;
    }
    render();
  }

  // Auto-load the word list from the repo on page load
  async function loadFromRepo() {
    state.loading = true;
    state.fetchFailed = false;
    render();
    try {
      const resp = await fetch(WORDS_FILE);
      if (!resp.ok) throw new Error('File not found: ' + resp.status);
      const buf = await resp.arrayBuffer();
      const data = new Uint8Array(buf);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      state.rawRows = rows;
      state.fileName = WORDS_FILE;
      state.loading = false;
      parseRows(rows, state.hasHeader);
      hidePalabraLoader();
    } catch (err) {
      state.loading = false;
      state.fetchFailed = true;
      state.showUpload = true;
      state.error = "Couldn't load \"" + WORDS_FILE + "\" automatically. If you're opening this file directly on your computer rather than through GitHub Pages or a local server, browsers block that kind of file access — try uploading it manually below, or view the page via its GitHub Pages URL instead.";
      render();
      hidePalabraLoader();
    }
  }

  // Fades out and removes the boot-time orb loader once the app has
  // reached an interactive state (word list loaded, or fallen back
  // to the manual-upload screen). Waits out APP_LOADING_MIN_MS first
  // so a fast load doesn't skip the animation entirely.
  function hidePalabraLoader() {
    const elapsed = Date.now() - appLoadingShownAt;
    const wait = Math.max(0, APP_LOADING_MIN_MS - elapsed);
    setTimeout(() => {
      const el = document.getElementById('app-loading');
      if (!el) return;
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 400);
    }, wait);
  }

  function handleFile(file) {
    if (!file) return;
    state.error = '';
    state.fileName = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        state.rawRows = rows;
        parseRows(rows, state.hasHeader);
      } catch (err) {
        state.error = "Couldn't read that file. Make sure it's a valid .xlsx or .xls file.";
        state.pairs = [];
        render();
      }
    };
    reader.onerror = () => { state.error = "Couldn't read that file."; render(); };
    reader.readAsArrayBuffer(file);
  }
