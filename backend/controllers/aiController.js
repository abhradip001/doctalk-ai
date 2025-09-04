// backend/controllers/aiController.js
const decisionEngine = require('../../ai-modules/symptom-analysis/decisionEngine');

/* ---------- helpers ---------- */

// Normalize KB severities to one scale used in UI (optional but nice)
const mapSeverity = (s) => {
  const m = { critical: 'emergency', high: 'urgent', moderate: 'routine', low: 'routine', unknown: 'unknown' };
  return m[String(s || 'unknown').toLowerCase()] || 'routine';
};

// Preliminary first aid guide (for supported conditions)
const FIRST_AID_GUIDE = {
  'flu': [
    'Encourage plenty of rest.',
    'Drink warm fluids to stay hydrated.',
    'Use fever reducers like paracetamol (if not allergic).',
    'Seek care if symptoms worsen or breathing problems develop.'
  ],
  'covid-19': [
    'Self-isolate from others immediately.',
    'Monitor oxygen saturation if possible.',
    'Rest and maintain hydration.',
    'Call a doctor right away if breathing difficulty appears.'
  ],
  'asthma': [
    'Use prescribed inhaler immediately.',
    'Sit upright and loosen tight clothing.',
    'Stay calm and take slow breaths.',
    'Seek emergency help if breathing does not improve.'
  ],
  'pneumonia': [
    'Keep the patient sitting upright.',
    'Ensure hydration and rest.',
    'Monitor breathing closely.',
    'Seek urgent medical care immediately.'
  ],
  'diabetes': [
    'If low blood sugar suspected: give a sweet drink or glucose tablets.',
    'If high blood sugar suspected: encourage hydration with water.',
    'Avoid heavy physical activity until checked.',
    'Seek medical review within 24–48 hours.'
  ],
  'hypertension': [
    'Help the patient sit calmly and rest.',
    'Avoid coffee or salty foods.',
    'Encourage slow deep breathing to reduce anxiety.',
    'Arrange a doctor visit soon.'
  ],
  'heart attack': [
    'Call emergency services immediately.',
    'Help the patient sit and rest, leaning slightly forward.',
    'Give one aspirin to chew (unless allergic).',
    'Loosen tight clothing and monitor breathing until help arrives.'
  ],
  'migraine': [
    'Move to a quiet, darkened room.',
    'Encourage rest and relaxation.',
    'Apply a cold compress to the forehead.',
    'Avoid loud noises and bright lights.'
  ],
  'arthritis': [
    'Encourage gentle movement of the affected joint.',
    'Apply warm compresses to ease stiffness.',
    'Use over-the-counter pain relief if safe.',
    'Seek physiotherapy advice if swelling is severe.'
  ],
  'skin infection': [
    'Wash the affected area gently with mild soap and water.',
    'Keep the area clean and dry.',
    'Avoid scratching or picking at the rash.',
    'Apply clean bandage if the skin is broken.'
  ],
  'bleeding': [
    'Apply firm pressure with a clean cloth.',
    'Elevate the injured area if possible.',
    'Do not remove objects stuck in the wound.',
    'Call emergency services if bleeding is severe.'
  ],
  'stroke': [
    'Call emergency services immediately.',
    'Have the patient lie on their side with head slightly raised.',
    'Do not give food, drink, or medication.',
    'Stay with them and monitor breathing until help arrives.'
  ],
  'tonsillitis': [
    'Encourage warm salt-water gargles.',
    'Offer soothing warm fluids.',
    'Use pain relievers like paracetamol (if safe).',
    'See a doctor if swallowing is severely difficult.'
  ],
  'bronchitis': [
    'Encourage rest and fluids.',
    'Use steam inhalation to ease cough.',
    'Avoid smoke or strong fumes.',
    'Seek medical review if fever or breathing worsens.'
  ],
  'appendicitis': [
    'Do not give food or drink.',
    'Avoid applying heat to the abdomen.',
    'Help the patient rest in a comfortable position.',
    'Call emergency services immediately.'
  ],
  'conjunctivitis': [
    'Wash hands before and after touching eyes.',
    'Use clean cloth with cool water to wipe discharge.',
    'Avoid sharing towels or pillows.',
    'See a doctor if pain or vision loss occurs.'
  ],
  'ear infection': [
    'Place a warm (not hot) compress over the ear for comfort.',
    'Keep the ear dry (no swimming).',
    'Use pain relievers if safe.',
    'See a doctor if fever or discharge develops.'
  ],
  'malaria': [
    'Keep the patient well hydrated.',
    'Encourage rest in a cool room.',
    'Control fever with paracetamol (if safe).',
    'Seek urgent medical attention immediately.'
  ],
  'thyroid disorder': [
    'Encourage the patient to take medications as prescribed.',
    'If palpitations or breathlessness occur, seek urgent care.',
    'Maintain hydration.',
    'See a doctor soon for proper testing.'
  ]
};

// NEW: plain-text formatter (replaces your JSON-like text)
function formatConditionsPlainText(conds = []) {
  if (!conds.length) return 'No conditions could be inferred. Please consult a doctor for proper evaluation.';

  // Sort by confidence desc
  const sorted = [...conds].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const top = sorted[0];

  const lines = [];
  lines.push(`Here’s what I think:\n`);

  sorted.forEach((c, idx) => {
    const name = (c.condition || 'Unknown condition').trim();
    const conf = typeof c.confidence === 'number' ? Math.round(c.confidence * 100) : 0;
    const ms = Array.isArray(c.matchedSymptoms) && c.matchedSymptoms.length ? c.matchedSymptoms.join(', ') : '—';
    const sev = c.details?.severity ? String(c.details.severity) : 'unknown';
    const urg = c.details?.urgency ? String(c.details.urgency) : 'as soon as possible';
    const recs = Array.isArray(c.details?.recommendations) && c.details.recommendations.length
      ? c.details.recommendations.join('; ')
      : '—';
    const firstAid = Array.isArray(c.firstAid) && c.firstAid.length ? c.firstAid.join('; ') : '—';

    lines.push(`${idx + 1}) ${capitalize(name)} — confidence ${conf}%`);
    lines.push(`   • Matched symptoms: ${ms}`);
    lines.push(`   • Severity: ${sev} | Urgency: ${urg}`);
    lines.push(`   • Recommendations: ${recs}`);
    lines.push(`   • First aid: ${firstAid}\n`);
  });

  // Summary from top pick
  const topName = capitalize(top.condition || 'Unknown condition');
  const topSev = top.details?.severity || 'unknown';
  const topUrg = top.details?.urgency || 'as soon as possible';

  lines.push(`Top condition: ${topName}`);
  lines.push(`Overall severity: ${topSev}`);
  lines.push(`Overall urgency: ${topUrg}`);

  return lines.join('\n');
}

function capitalize(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- controller ---------- */

exports.chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    // 1) Run engine
    const result = await decisionEngine.analyzeSymptoms(message) || {};

    // 2) Normalize array + fallback
    let matched = Array.isArray(result.matchedConditions) ? result.matchedConditions : [];
    if (!matched.length) {
      matched = [{
        condition: 'Unknown condition',
        matchedSymptoms: [],
        confidence: 0,
        details: {
          severity: 'unknown',
          recommendations: ['Consult a doctor for further evaluation'],
          urgency: 'as soon as possible'
        },
        firstAid: []
      }];
    }

    // 3) Unify severity names + attach first aid tips if available
    matched = matched.map(m => {
      const key = String(m.condition || '').toLowerCase();
      const fa = FIRST_AID_GUIDE[key] || [];
      return {
        ...m,
        details: { ...m.details, severity: mapSeverity(m.details?.severity) },
        firstAid: fa
      };
    });

    // 4) Build a PLAIN TEXT reply (not JSON-like)
    const reply = formatConditionsPlainText(matched);

    // 5) Return payload
    return res.json({
      ok: true,
      reply,                       // <-- plain text block now
      matchedConditions: matched,  // keep structured JSON for UI/cards if needed
      doctors: result.recommendedDoctors || [],
      isEmergency: !!result.isEmergency,
      specialties: result.specialties || []
    });
  } catch (err) {
    console.error('AI Chat Error:', err);
    return res.status(500).json({
      ok: false,
      reply: 'Sorry, something went wrong while generating a response.',
      matchedConditions: [],
      doctors: [],
      isEmergency: false,
      specialties: []
    });
  }
};
