// Round-building and distractor selection for word-based (non-conjugate)
// modes, plus lowest-box word lookup for Daily Double.


  function buildRound(pairs, length, directionSetting) {
    let selected = [];
    while (selected.length < length) {
      const remaining = length - selected.length;
      const batchSize = Math.min(remaining, pairs.length);
      const batch = weightedSampleWithoutReplacement(pairs, getWeight, batchSize);
      selected = selected.concat(batch);
    }
    return selected.map(p => ({
      ...p,
      direction: directionSetting === 'mixed' ? (Math.random() < 0.5 ? 'es-en' : 'en-es') : directionSetting,
    }));
  }

  // Builds `count` more Stream questions, each carrying its own answer
  // format (mc / audio / type) so the format varies question to question
  // instead of being fixed for the whole round like normal Quiz. Uses the
  // same weighted due/never-seen selection as everything else (getWeight),
  // sampling WITH replacement (via weightedPickOne) since a continuous
  // stream can't rely on a finite without-replacement pool the way a
  // fixed-length round does.
  function buildStreamBatch(pairs, count, avoidKey, startPosition) {
    const batch = [];
    let lastKey = avoidKey || null;
    for (let i = 0; i < count; i++) {
      const p = weightedPickOne(pairs, getWeight, lastKey);
      lastKey = wordKey(p);
      let format = STREAM_FORMATS[(startPosition + i) % STREAM_FORMATS.length];
      // Cloze only works for words that actually have sentence data -
      // most won't yet. Falling back to typed translation keeps the
      // rotation's cadence intact instead of skipping this word entirely.
      if (format === 'cloze' && !findClozeBlank(p)) format = 'type';
      // Scramble reuses the same sentence bank as cloze (and the same
      // findClozeBlank() validity check, though only to confirm a usable
      // sentence exists - the actual scramble logic is unrelated to
      // blank-finding). Same type fallback for words without one.
      if (format === 'scramble' && !findClozeBlank(p)) format = 'type';
      batch.push({
        ...p,
        direction: Math.random() < 0.5 ? 'es-en' : 'en-es',
        // Cycles on a running position (not i, which resets every batch)
        // so format rotation stays deliberate across batch top-ups instead
        // of risking two of the same format landing back-to-back at a
        // batch boundary.
        format,
      });
    }
    return batch;
  }

  function getDistractors(current, correctText, count) {
    const isEnglishTarget = current.direction === 'es-en';
    const seen = new Set([normalize(correctText)]);
    const candidates = [];
    activePairs().forEach(p => {
      if (wordKey(p) === wordKey(current)) return;
      const field = isEnglishTarget ? p.en : p.es;
      const text = splitAnswers(field)[0];
      if (!text) return;
      const n = normalize(text);
      if (seen.has(n)) return;
      seen.add(n);
      candidates.push(text);
    });
    return shuffle(candidates).slice(0, count);
  }

  // Lowest-box entries first (what you're weakest on right now), then
  // highest wrong-count as a tiebreaker, then least-recently-seen last.
  // Prefers stored display text, but falls back to matching against
  // whichever word list is currently loaded (state.pairs) for older entries
  // recorded before that field existed - so they show up immediately
  // instead of waiting to be answered again. Only entries matching neither
  // source (rare: a word from a list not currently loaded) are skipped -
  // they're still fully counted in boxCounts() above regardless.
  function lowestBoxWords(limit) {
    const fallback = {};
    state.pairs.forEach(pair => { fallback[wordKey(pair)] = pair; });

    const sorted = Object.entries(state.progress.wordStats)
      .sort((a, b) => (a[1].box - b[1].box) || (b[1].wrong - a[1].wrong) || (a[1].lastSeen - b[1].lastSeen));

    const out = [];
    for (const [key, ws] of sorted) {
      const fb = fallback[key];
      const es = ws.es || (fb && fb.es);
      const en = ws.en || (fb && fb.en);
      if (es && en) {
        out.push({ es, en, box: ws.box, wrong: ws.wrong });
        if (out.length >= limit) break;
      }
    }
    return out;
  }
