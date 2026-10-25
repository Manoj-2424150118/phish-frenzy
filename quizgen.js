// Generate 4-option MCQs from raw notes text (pasted or extracted from PDF).
// Two strategies: definition questions ("X is Y") and cloze (fill-in-the-blank).
// Output shape matches questions.js: { prompt, options[4], answer, explain }

const STOP = new Set(('the a an and or of to in is are was were be been being for on with as by at from it its this that these those which who whom what when where why how can could should would may might must shall will do does did have has had not no yes if then than so such into over under between about after before during each other any all some more most many much own same only also just very').split(' '));

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/•/g, '. ')
    .trim();
}

function splitSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]+/g) || [];
  return parts.map(s => s.trim()).filter(s => s.length >= 40 && s.length <= 320 && /[a-zA-Z]/.test(s));
}

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function vocab(sentences) {
  const freq = new Map();
  for (const s of sentences) {
    for (const w of s.replace(/[^a-zA-Z' -]/g, ' ').split(/\s+/)) {
      const lw = w.toLowerCase();
      if (lw.length >= 5 && !STOP.has(lw)) freq.set(lw, (freq.get(lw) || 0) + 1);
    }
  }
  return [...freq.keys()];
}

function finish(prompt, correct, distractors, explain) {
  const opts = shuffle([correct, ...shuffle(distractors).slice(0, 3)]);
  if (opts.length < 4) return null;
  return { prompt, options: opts, answer: opts.indexOf(correct), explain };
}

function generateFromText(rawText, max = 20) {
  const text = cleanText(rawText);
  if (text.length < 200) return { questions: [], reason: 'Notes are too short — paste at least a few paragraphs (200+ characters).' };
  const sentences = splitSentences(text);
  if (sentences.length < 4) return { questions: [], reason: 'Could not find enough complete sentences in the notes.' };
  const words = vocab(sentences);
  const questions = [];
  const usedPrompts = new Set();

  // 1) Definition questions: "Term is/are/means ... ."
  const defs = [];
  const defRe = /^([A-Z][A-Za-z0-9 &/-]{2,48}?)\s+(is|are|means|refers to|stands for)\s+(.+?)[.!?]$/;
  for (const s of sentences) {
    const m = s.match(defRe);
    if (m && m[3].length >= 15 && m[3].length <= 160) defs.push({ term: m[1].trim(), def: m[3].trim() });
  }
  for (const d of shuffle(defs)) {
    if (questions.length >= max) break;
    const others = defs.filter(o => o !== d).map(o => o.def);
    if (others.length < 3) break;
    const key = 'def:' + d.term.toLowerCase();
    if (usedPrompts.has(key)) continue;
    usedPrompts.add(key);
    const q = finish(`According to the notes, what is ${d.term}?`, d.def, others,
      `From your notes: “${d.term} is ${d.def}.”`);
    if (q) questions.push(q);
  }

  // 2) Cloze questions: hide a key word in a sentence
  for (const s of shuffle(sentences)) {
    if (questions.length >= max) break;
    const clean = s.replace(/[.!?]$/, '');
    const tokens = clean.split(/\s+/);
    if (tokens.length < 9 || tokens.length > 34) continue;
    // candidate key words: longest non-stopword tokens (prefer mid-sentence capitalised terms)
    const candidates = tokens
      .map((w, i) => ({ w: w.replace(/[^A-Za-z'-]/g, ''), i }))
      .filter(({ w, i }) => i > 0 && w.length >= 6 && !STOP.has(w.toLowerCase()));
    if (!candidates.length) continue;
    candidates.sort((a, b) => b.w.length - a.w.length);
    const pick = candidates[0];
    const answerWord = pick.w;
    const distractors = words.filter(w => w.toLowerCase() !== answerWord.toLowerCase() &&
      Math.abs(w.length - answerWord.length) <= 4);
    if (distractors.length < 3) continue;
    const blanked = tokens.map((w, i) => i === pick.i ? '________' : w).join(' ');
    const key = 'cloze:' + blanked.slice(0, 60);
    if (usedPrompts.has(key)) continue;
    usedPrompts.add(key);
    const display = Math.random() < 0.5 ? answerWord : answerWord.toLowerCase();
    const q = finish(`Fill in the blank from your notes: “${blanked}”`, display,
      shuffle(distractors).slice(0, 3).map(w => Math.random() < 0.5 ? w : w),
      `From your notes: “${clean}.”`);
    if (q) questions.push(q);
  }

  if (questions.length < 3) {
    return { questions, reason: 'Only a few questions could be built — add more detailed notes (definitions work best) for a fuller quiz.' };
  }
  return { questions, reason: null };
}

module.exports = { generateFromText };
