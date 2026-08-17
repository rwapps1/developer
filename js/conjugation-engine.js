// Spanish present-tense conjugation: irregular/stem-change/regular verb
// tables and the conjugation functions built on them. These tables are used
// exclusively here, so - per the local-to-consumer rule - they live here
// rather than in config.js.

  const REFLEXIVE_PRONOUNS = ['me', 'te', 'se', 'nos', 'os', 'se'];

  const REGULAR_ENDINGS = {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  };

  const IRREGULAR_VERBS = {
    ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
    estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
    haber: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
    dar: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
    ver: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
    oír: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
    oler: ['huelo', 'hueles', 'huele', 'olemos', 'oléis', 'huelen'],
    reír: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'],
    sonreír: ['sonrío', 'sonríes', 'sonríe', 'sonreímos', 'sonreís', 'sonríen'],
    enviar: ['envío', 'envías', 'envía', 'enviamos', 'enviáis', 'envían'],
  };

  const YO_IRREGULAR = {
    tener: 'tengo', hacer: 'hago', poner: 'pongo', salir: 'salgo',
    traer: 'traigo', saber: 'sé', caber: 'quepo', valer: 'valgo',
    conocer: 'conozco', conducir: 'conduzco', traducir: 'traduzco',
    parecer: 'parezco', ofrecer: 'ofrezco', decir: 'digo', venir: 'vengo',
    caer: 'caigo', agradecer: 'agradezco', nacer: 'nazco',
    seguir: 'sigo',
  };

  const STEM_CHANGES = {
    querer: 'e-ie', pensar: 'e-ie', perder: 'e-ie', entender: 'e-ie',
    cerrar: 'e-ie', empezar: 'e-ie', comenzar: 'e-ie', preferir: 'e-ie',
    sentir: 'e-ie', tener: 'e-ie', venir: 'e-ie', encender: 'e-ie', despertar: 'e-ie',
    nevar: 'e-ie', sentar: 'e-ie',
    poder: 'o-ue', dormir: 'o-ue', volver: 'o-ue', contar: 'o-ue',
    encontrar: 'o-ue', recordar: 'o-ue', mostrar: 'o-ue', costar: 'o-ue',
    mover: 'o-ue', volar: 'o-ue', acostar: 'o-ue', morir: 'o-ue', llover: 'o-ue',
    pedir: 'e-i', servir: 'e-i', repetir: 'e-i', seguir: 'e-i', decir: 'e-i',
    vestir: 'e-i', despedir: 'e-i', competir: 'e-i',
    jugar: 'u-ue',
    construir: 'y-insert',
  };
  const BOOT_PERSONS = [0, 1, 2, 5];
  const IMPERSONAL_VERBS = ['llover', 'nevar'];

  function applyStemChange(stem, type) {
    if (type === 'y-insert') return stem + 'y';
    const map = { 'e-ie': ['e', 'ie'], 'o-ue': ['o', 'ue'], 'e-i': ['e', 'i'], 'u-ue': ['u', 'ue'] };
    const [from, to] = map[type];
    const idx = stem.lastIndexOf(from);
    if (idx === -1) return stem;
    return stem.slice(0, idx) + to + stem.slice(idx + from.length);
  }

  function conjugateBase(inf, personIndex) {
    if (IRREGULAR_VERBS[inf]) return IRREGULAR_VERBS[inf][personIndex];
    const ending = inf.slice(-2);
    const stem = inf.slice(0, -2);
    if (!['ar', 'er', 'ir'].includes(ending)) return null;
    if (personIndex === 0 && YO_IRREGULAR[inf]) return YO_IRREGULAR[inf];
    let effectiveStem = stem;
    const changeType = STEM_CHANGES[inf];
    if (changeType && BOOT_PERSONS.includes(personIndex)) {
      effectiveStem = applyStemChange(stem, changeType);
    }
    return effectiveStem + REGULAR_ENDINGS[ending][personIndex];
  }

  // Returns the conjugated form (a single word, or "pronoun verb" for
  // reflexives), or null if the verb's shape isn't recognized at all.
  function conjugatePresent(infinitive, personIndex) {
    const inf = infinitive.toLowerCase().trim();
    if (inf.endsWith('se') && inf.length > 2) {
      const base = inf.slice(0, -2);
      if (['ar', 'er', 'ir'].includes(base.slice(-2))) {
        const baseForm = conjugateBase(base, personIndex);
        if (baseForm === null) return null;
        return REFLEXIVE_PRONOUNS[personIndex] + ' ' + baseForm;
      }
    }
    return conjugateBase(inf, personIndex);
  }

  function validPersonsFor(infinitive) {
    return IMPERSONAL_VERBS.includes(infinitive.toLowerCase().trim()) ? [2] : [0, 1, 2, 3, 4, 5];
  }
