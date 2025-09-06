const natural = require('natural');
const translate = require('google-translate-api-x');
const ChatLearning = require('../../backend/models/ChatLearning');

const { WordTokenizer, PorterStemmer, NGrams, Stopwords } = natural;
const tokenizer = new WordTokenizer();
const STOP = new Set(Stopwords);
const stem = (w) => PorterStemmer.stem(w);

// -------------------- INITIAL MEDICAL SYMPTOMS --------------------
let MEDICAL_TERMS = {
  headache: ['migraine', 'tension headache', 'cluster headache', 'sinusitis'],
  fever: ['infection', 'flu', 'covid', 'malaria', 'typhoid'],
  cough: ['cold', 'flu', 'bronchitis', 'pneumonia', 'asthma'],
  pain: ['chest pain', 'abdominal pain', 'joint pain', 'back pain', 'toothache'],
  rash: ['skin infection', 'allergy', 'eczema', 'measles'],
  shortness: ['asthma', 'pneumonia', 'heart attack', 'COPD'],
  nausea: ['migraine', 'heart attack', 'food poisoning', 'gastritis'],
  joint: ['arthritis', 'gout', 'sprain'],
  swelling: ['arthritis', 'injury', 'infection', 'edema'],
  fatigue: ['flu', 'diabetes', 'hypertension', 'thyroid disorder', 'anemia'],
  dizziness: ['vertigo', 'low blood pressure', 'dehydration', 'stroke'],
  throat: ['tonsillitis', 'strep throat', 'laryngitis'],
  stomach: ['gastritis', 'ulcer', 'appendicitis', 'indigestion'],
  eye: ['conjunctivitis', 'glaucoma', 'cataract'],
  ear: ['ear infection', 'hearing loss', 'vertigo'],

  // helpful synonyms
  vomiting: ['nausea', 'migraine', 'food poisoning', 'gastritis', 'flu'],

  // phrase keys you want to detect directly
  'chest pain': ['heart attack', 'angina'],
  'shortness of breath': ['asthma', 'pneumonia', 'heart failure'],
  'extreme thirst': ['diabetes', 'dehydration'],
  'frequent urination': ['diabetes', 'urinary tract infection'],
  'blurred vision': ['diabetes'],

  // single-word fallbacks to catch partial mentions
  thirst: ['diabetes', 'dehydration'],
  urination: ['diabetes', 'urinary tract infection']
};

// -------------------- TRAINING DATA --------------------
const TRAINING_DATA = [
  { text: "I have headache and fever", label: "flu" },
  { text: "My head hurts and I feel hot", label: "flu" },
  { text: "Cough and difficulty breathing", label: "pneumonia" },
  { text: "Wheezing and breathlessness", label: "asthma" },
  { text: "Stomach pain and diarrhea", label: "digestive" },
  { text: "Joint pain and stiffness", label: "arthritis" },
  { text: "Chest pain and sweating", label: "heart attack" },
  { text: "Skin rash and redness", label: "skin infection" },
  { text: "Blurred vision and fatigue", label: "diabetes" },
  { text: "Headache and nausea", label: "migraine" },
  { text: "Fever with chills and body ache", label: "malaria" },
  { text: "Severe sore throat and difficulty swallowing", label: "tonsillitis" },
  { text: "Constant cough with mucus", label: "bronchitis" },
  { text: "Sudden dizziness and loss of balance", label: "stroke" },
  { text: "Pain in the lower right abdomen", label: "appendicitis" },
  { text: "Red itchy eyes with discharge", label: "conjunctivitis" },
  { text: "Ear pain and mild fever", label: "ear infection" },
  { text: "Extreme thirst and frequent urination", label: "diabetes" },
  { text: "Unexplained weight loss and fatigue", label: "thyroid disorder" },
  { text: "Swelling in the legs and shortness of breath", label: "heart failure" }
];

// -------------------- Classifier --------------------
const classifier = new natural.BayesClassifier(PorterStemmer);
TRAINING_DATA.forEach(d => classifier.addDocument(d.text, d.label));
classifier.train();

// -------------------- Indexes (built once) --------------------
// stemmed token -> canonical key
const STEM_INDEX = {};
Object.keys(MEDICAL_TERMS).forEach(k => { STEM_INDEX[stem(k)] = k; });

// medical vocab to avoid learning junk (keys + values, lowercase)
const MEDICAL_VOCAB = new Set([
  ...Object.keys(MEDICAL_TERMS).map(k => k.toLowerCase()),
  ...Object.values(MEDICAL_TERMS).flat().map(v => v.toLowerCase())
]);

// phrase indexes for fast lookup
const PHRASE_INDEX = new Map(); // phrase key -> related conditions
const VALUE_PHRASES = new Set(); // phrases that occur in values
Object.entries(MEDICAL_TERMS).forEach(([k, vals]) => {
  if (k.includes(' ')) PHRASE_INDEX.set(k.toLowerCase(), vals);
  vals.forEach(v => { if (v.includes(' ')) VALUE_PHRASES.add(v.toLowerCase()); });
});

// -------------------- NEW: merged-phrase & fuzzy correction --------------------
// Build a set of all phrases (keys + phrase values)
const ALL_PHRASES = new Set([
  ...Object.keys(MEDICAL_TERMS).map(k => k.toLowerCase()),
  ...VALUE_PHRASES
]);

// map "chestpain" -> "chest pain", "shortnessofbreath" -> "shortness of breath"
const MERGED_MAP = {};
ALL_PHRASES.forEach(p => {
  if (p.includes(' ')) MERGED_MAP[p.replace(/\s+/g, '')] = p;
});

function autoSplitMergedPhrases(str) {
  let s = String(str).toLowerCase();
  for (const [merged, phrase] of Object.entries(MERGED_MAP)) {
    s = s.replace(new RegExp(`\\b${merged}\\b`, 'g'), phrase);
  }
  return s;
}

// WORD_VOCAB: all single words that appear in any key or value (for fuzzy fix)
const WORD_VOCAB = new Set();
Object.keys(MEDICAL_TERMS).forEach(k => k.toLowerCase().split(/\s+/).forEach(w => WORD_VOCAB.add(w)));
Object.values(MEDICAL_TERMS).flat().forEach(v => v.toLowerCase().split(/\s+/).forEach(w => WORD_VOCAB.add(w)));
const WORD_LIST = [...WORD_VOCAB];

function fuzzyMapToken(token) {
  if (WORD_VOCAB.has(token)) return token;
  if (token.length < 5) return token; // avoid over-correcting short words

  let best = token;
  let bestDist = Infinity;

  for (const w of WORD_LIST) {
    const d = natural.LevenshteinDistance(token, w);
    if (d < bestDist) {
      bestDist = d;
      best = w;
      if (bestDist === 0) break;
    }
  }
  const maxEdits = token.length >= 8 ? 2 : 1; // allow 1–2 edits
  return (bestDist <= maxEdits) ? best : token;
}

// -------------------- Label normalization & severity rules --------------------
const NORMALIZE_LABEL = {
  'heart attack': 'myocardial_infarction',
  'heart failure': 'heart_failure',
  'shortness': 'shortness_of_breath',
  'strep throat': 'strep_throat',
  'ear infection': 'otitis_media',
  'skin infection': 'skin_infection'
  // add as needed
};

const EMERGENCY_SET = new Set([
  'heart attack', 'myocardial_infarction', 'stroke', 'appendicitis', 'heart failure', 'pneumonia'
]);

function normalizeLabel(lbl) {
  if (!lbl) return lbl;
  return NORMALIZE_LABEL[lbl] || lbl.replace(/\s+/g, '_').toLowerCase();
}

function inferSeverity(classLabel, foundSet) {
  const found = new Set([...foundSet].map(s => s.toLowerCase()));
  const c = (classLabel || '').toLowerCase();

  if (EMERGENCY_SET.has(c)) return 'emergency';
  if (found.has('chest pain') || (found.has('shortness of breath') && found.has('swelling'))) return 'emergency';
  if (found.has('fever') && (found.has('cough') || found.has('sore throat'))) return 'urgent';
  if (c === 'diabetes' || c === 'thyroid disorder' || found.has('fatigue')) return 'urgent';
  if (found.has('extreme thirst') || found.has('frequent urination') || found.has('thirst') || found.has('urination')) return 'urgent';
  return 'routine';
}

function recommendationsFor(severity) {
  if (severity === 'emergency') {
    return [
      'Call local emergency services immediately or go to the nearest ER.',
      'Avoid driving yourself; ask someone to help.',
      'Keep sitting upright and avoid heavy activity.'
    ];
  }
  if (severity === 'urgent') {
    return [
      'Consult a clinician within 24–48 hours.',
      'Monitor temperature, hydration, and breathing.',
      'Use over-the-counter symptom relief if previously safe for you.'
    ];
  }
  return [
    'Rest, hydrate, and monitor symptoms.',
    'Use over-the-counter relief if needed and safe for you.',
    'Seek care if symptoms worsen or persist beyond 48–72 hours.'
  ];
}

// -------------------- Learning unknown symptoms --------------------
const learnNewSymptom = async (symptoms, originalText, translatedText, lang) => {
  symptoms.forEach(symptom => {
    if (!MEDICAL_TERMS[symptom]) {
      MEDICAL_TERMS[symptom] = [symptom];
      STEM_INDEX[stem(symptom)] = symptom;
      MEDICAL_VOCAB.add(symptom);
      if (symptom.includes(' ')) PHRASE_INDEX.set(symptom, [symptom]);
      console.log(`🧠 Learned new symptom: ${symptom}`);
    }
  });

  await ChatLearning.create({
    originalText,
    translatedText,
    detectedLanguage: lang,
    newSymptoms: symptoms
  });
};

// -------------------- MAIN PROCESSING FUNCTION --------------------
async function processInput(text, opts = {}) {
  const { learn = true, confidenceThreshold = 0.08 } = opts;

  let detectedLanguage = 'en';
  let translatedText = text;

  // --------- Translation ---------
  try {
    const translation = await translate(text, { to: 'en' });
    detectedLanguage = (translation.from && translation.from.language && translation.from.language.iso) || 'en';
    translatedText = translation.text || text;
  } catch (err) {
    console.warn('Translation failed, using original text');
  }

  // --------- Normalization: split merged phrases (e.g., "chestpain" -> "chest pain") ---------
  const normalized = autoSplitMergedPhrases(translatedText);
  const lower = normalized.toLowerCase();

  // --------- NLP ---------
  const rawTokens = tokenizer.tokenize(lower).filter(t => /^[a-z]+$/.test(t));

  // fuzzy-correct tokens before stemming
  const correctedTokens = rawTokens.map(fuzzyMapToken);

  const stemmedTokens = correctedTokens.map(stem);

  // bigrams + trigrams for phrase detection
  const bigrams = NGrams.ngrams(lower, 2).map(g => g.join(' '));
  const trigrams = NGrams.ngrams(lower, 3).map(g => g.join(' '));
  const ngramSet = new Set([...bigrams, ...trigrams]);

  // --------- Symptom detection ---------
  const found = new Set();

  // (1) unigram via stem index
  stemmedTokens.forEach(st => {
    const key = STEM_INDEX[st];
    if (key) {
      found.add(key);
      (MEDICAL_TERMS[key] || []).forEach(cond => found.add(cond));
    }
  });

  // (2) phrase keys
  ngramSet.forEach(phrase => {
    const vals = PHRASE_INDEX.get(phrase);
    if (vals) {
      found.add(phrase);
      vals.forEach(cond => found.add(cond));
    }
  });

  // (3) phrase values present in text
  VALUE_PHRASES.forEach(valPhrase => {
    if (lower.includes(valPhrase)) found.add(valPhrase);
  });

  // --------- Classification ---------
  const classification = classifier.classify(normalized);
  const scores = classifier.getClassifications
    ? classifier.getClassifications(normalized) // [{label, value}, ...]
    : undefined;

  let confidence;
  let normalizedLabel = classification ? normalizeLabel(classification) : undefined;

  if (scores && scores.length > 1) {
    const sorted = [...scores].sort((a, b) => b.value - a.value);
    confidence = sorted[0].value - sorted[1].value;
    normalizedLabel = normalizeLabel(sorted[0].label);
  }

  // gate by confidence
  let condition = normalizedLabel;
  if (confidence !== undefined && confidence < confidenceThreshold) {
    condition = 'uncertain';
  }

  // --------- Diabetes fallback: thirst + urination implies diabetes when confidence is low ---------
  const foundLower = new Set([...found].map(s => s.toLowerCase()));
  if ((condition === 'uncertain' || !condition) &&
      ((foundLower.has('extreme thirst') || foundLower.has('thirst')) &&
       (foundLower.has('frequent urination') || foundLower.has('urination')))) {
    condition = 'diabetes';
    confidence = Math.max(confidence || 0, 0.12);
  }

  // --------- TF-IDF (per-call) ---------
  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();
  tfidf.addDocument(normalized);
  const importantTerms = [];
  tfidf.listTerms(tfidf.documents.length - 1).forEach(item => {
    if (item.tfidf > 0.2) importantTerms.push(item.term);
  });

  // --------- Auto-learn (noise-filtered) ---------
  const unknownCandidates = correctedTokens.filter(t =>
    !STOP.has(t) && t.length > 2 && /^[a-z]+$/.test(t) && !MEDICAL_VOCAB.has(t)
  );

  const unknownSymptoms = [...new Set(unknownCandidates)].slice(0, 5);

  if (learn && unknownSymptoms.length > 0) {
    await learnNewSymptom(unknownSymptoms, text, normalized, detectedLanguage);
  }

  // --------- Severity + Recommendations ---------
  const severity = inferSeverity(condition, found);
  const recommendations = recommendationsFor(severity);

  return {
    // original outputs
    originalText: text,
    detectedLanguage,
    translatedText: normalized,       // after normalization for transparency
    tokens: stemmedTokens,
    symptoms: [...found],
    unknownSymptoms,
    classification: condition,        // normalized + gated (with diabetes fallback)
    scores,
    confidence,
    importantTerms,

    // structured medical output (for your UI cards)
    condition,                        // alias for clarity
    severity,                         // 'emergency' | 'urgent' | 'routine'
    recommendations                   // string[]
  };
}

module.exports = { processInput };


