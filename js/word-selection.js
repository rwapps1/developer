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
  // format (mc/audio/type/cloze/truefalse/scramble) so the format varies
  // question to question instead of being fixed for the whole round like
  // normal Quiz.
  //
  // Format is dealt from state.streamFormatBag — a shuffled "bag" holding
  // whichever of the 6 STREAM_FORMATS haven't been dealt yet this cycle,
  // refilled with a fresh shuffle of all 6 the moment it runs empty (see
  // state.js). That guarantees every 6 questions still contains every
  // format exactly once — the same variety guarantee Stream has always
  // had — but in an unpredictable order each cycle rather than a fixed
  // repeating pattern, so a player can't tell what's coming next.
  //
  // Word selection still uses the same weighted due/never-seen priority as
  // everything else (getWeight), sampling WITH replacement (via
  // weightedPickOne) since a continuous stream can't rely on a finite
  // without-replacement pool the way a fixed-length round does. On top of
  // that, once this slot's format is known, word selection prefers a word
  // whose SRS box already meets that format's STREAM_FORMAT_MIN_BOX (see
  // config.js) — so harder formats preferentially land on well-known words.
  //
  // If nothing meets that bar yet, selection relaxes through progressively
  // broader tiers rather than dropping straight to the fully unrestricted
  // pool:
  //   1. Box-preference met (+ has a sentence, for Cloze/Scramble).
  //   2. Box preference relaxed, but still a word the player has been shown
  //      at least once before (has a wordStats entry, any box) - this is
  //      the important middle step. Reaching box 4-5 takes 5 correct
  //      answers spaced over weeks per SRS_INTERVALS_DAYS, so "no word
  //      meets the box preference yet" is the NORMAL state for a large
  //      chunk of any account's early life, not a rare edge case.
  //   3. Only for Cloze/Scramble, which need real sentence data to work at
  //      all regardless of exposure: any word with a sentence, even one
  //      never seen before.
  //   4. True last resort: the fully unrestricted pool, same as the app's
  //      behaviour before this feature existed.
  //
  // Crucially, within whichever of these tiers ends up used, selection
  // ALSO avoids the last several words already asked in this stream
  // (state.streamRecentWordKeys), moving to a broader tier if the current
  // one has nothing fresh left - rather than treating "this tier has at
  // least one word in it" as good enough. Without this, an account with
  // only one or two words that happen to qualify for a format's preferred
  // box (very common early on, and easy to hit deliberately on a test
  // account) had that same tiny handful of words - sometimes literally
  // one word - handed out over and over across a stream, which is worse
  // for a learner than a slightly loose difficulty match.
  function buildStreamBatch(pairs, count, avoidKey) {
    const batch = [];
    let lastKey = avoidKey || null;
    for (let i = 0; i < count; i++) {
      if (state.streamFormatBag.length === 0) {
        state.streamFormatBag = shuffle(STREAM_FORMATS);
      }
      let format = state.streamFormatBag.shift();

      const minBox = STREAM_FORMAT_MIN_BOX[format];
      const needsSentence = format === 'cloze' || format === 'scramble';
      const hasSentence = p => !needsSentence || findClozeBlank(p);
      const meetsBox = p => {
        if (typeof minBox !== 'number') return true;
        const stats = state.progress.wordStats[wordKey(p)];
        return !!stats && stats.box >= minBox;
      };
      const everSeen = p => !!state.progress.wordStats[wordKey(p)];

      // Progressively broader candidate tiers, most-ideal first. Always
      // ends with the fully unrestricted pool, so something is always
      // available.
      const tiers = [];
      if (typeof minBox === 'number') tiers.push(pairs.filter(p => meetsBox(p) && hasSentence(p)));
      if (typeof minBox === 'number' || needsSentence) tiers.push(pairs.filter(p => everSeen(p) && hasSentence(p)));
      if (needsSentence) tiers.push(pairs.filter(hasSentence));
      tiers.push(pairs);

      const recent = state.streamRecentWordKeys;
      let candidatePairs = null;
      for (const tier of tiers) {
        if (tier.length === 0) continue;
        const fresh = tier.filter(t => !recent.includes(wordKey(t)));
        if (fresh.length > 0) { candidatePairs = fresh; break; }
      }
      if (candidatePairs === null) {
        // Nothing anywhere is "fresh" (only plausible with a tiny pool or
        // an extremely narrow tier) - fall back to the broadest non-empty
        // tier rather than the narrowest, to maximise variety even though
        // a repeat is unavoidable this once.
        for (let idx = tiers.length - 1; idx >= 0; idx--) {
          if (tiers[idx].length > 0) { candidatePairs = tiers[idx]; break; }
        }
      }

      const p = weightedPickOne(candidatePairs, getWeight, lastKey);
      lastKey = wordKey(p);
      state.streamRecentWordKeys.push(lastKey);
      if (state.streamRecentWordKeys.length > STREAM_RECENT_WORD_WINDOW) {
        state.streamRecentWordKeys.shift();
      }

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
