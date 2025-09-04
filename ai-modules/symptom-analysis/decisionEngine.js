// ai-modules/symptom-analysis/decisionEngine.js
const nlpProcessor = require('./nlpProcessor');
const Doctor = require('../../backend/models/Doctor');

// --- Simple condition KB for heuristic matching ---
const MEDICAL_KB = {
  flu: {
    symptoms: ['fever', 'headache', 'cough', 'fatigue'],
    severity: 'moderate',
    recommendations: ['rest', 'hydration', 'paracetamol'],
    urgency: 'within 24 hours'
  },
  'covid-19': {
    symptoms: ['fever', 'dry cough', 'loss of taste', 'loss of smell', 'breathing difficulty'],
    severity: 'high',
    recommendations: ['self-isolate', 'monitor oxygen levels', 'consult doctor'],
    urgency: 'immediate'
  },
  asthma: {
    symptoms: ['wheezing', 'shortness of breath', 'chest tightness', 'cough'],
    severity: 'high',
    recommendations: ['use inhaler', 'avoid triggers', 'consult pulmonologist'],
    urgency: 'immediate'
  },
  pneumonia: {
    symptoms: ['fever', 'chills', 'chest pain', 'cough with phlegm', 'breathing difficulty'],
    severity: 'high',
    recommendations: ['antibiotics', 'rest', 'hydration'],
    urgency: 'immediate'
  },
  diabetes: {
    symptoms: ['frequent urination', 'increased thirst', 'fatigue', 'blurred vision'],
    severity: 'moderate',
    recommendations: ['monitor blood sugar', 'diet control', 'consult diabetologist'],
    urgency: 'within a week'
  },
  hypertension: {
    symptoms: ['headache', 'dizziness', 'blurred vision', 'nosebleed'],
    severity: 'moderate',
    recommendations: ['reduce salt', 'exercise', 'consult physician'],
    urgency: 'within a week'
  },
  'heart attack': {
    symptoms: ['chest pain', 'shortness of breath', 'sweating', 'nausea'],
    severity: 'critical',
    recommendations: ['call emergency', 'aspirin if available'],
    urgency: 'immediate'
  },
  migraine: {
    symptoms: ['headache', 'nausea', 'sensitivity to light', 'sensitivity to sound'],
    severity: 'moderate',
    recommendations: ['pain relievers', 'rest in dark room'],
    urgency: 'within 24 hours'
  },
  arthritis: {
    symptoms: ['joint pain', 'stiffness', 'swelling', 'reduced range of motion'],
    severity: 'low',
    recommendations: ['physiotherapy', 'pain relief medication'],
    urgency: 'within a week'
  },
  'skin infection': {
    symptoms: ['rash', 'redness', 'itching', 'swelling'],
    severity: 'low',
    recommendations: ['topical creams', 'keep area clean'],
    urgency: 'within a few days'
  }
};

// One condition -> multiple specialties
const CONDITION_TO_SPECIALIZATIONS = {
  flu: ['General Physician'],
  'covid-19': ['General Physician', 'Pulmonology'],
  asthma: ['Pulmonology', 'General Physician'],
  pneumonia: ['Pulmonology', 'General Physician'],
  diabetes: ['Endocrinology', 'General Physician', 'Diabetology', 'Diabetologist'],
  hypertension: ['Cardiology', 'General Physician'],
  'heart attack': ['Cardiology', 'Emergency Medicine'],
  migraine: ['Neurology'],
  arthritis: ['Orthopedics', 'Rheumatology'],
  'skin infection': ['Dermatology']
};

// Emergency heuristics
const EMERGENCY_KEYWORDS = [
  'chest pain',
  'difficulty breathing',
  'shortness of breath',
  'severe pain',
  'weakness on one side',
  'fainting'
];

function normalize(s) { return String(s || '').toLowerCase().trim(); }

async function findDoctorsBySpecialties(specialties, limit = 20) {
  if (!Array.isArray(specialties) || specialties.length === 0) return [];

  // Build a case-insensitive OR regex query over specialization
  const or = specialties.map(sp => ({
    specialization: { $regex: `^${sp}$`, $options: 'i' }
  }));

  // If your DB uses varied names (e.g. "General Physician (Internal Medicine)"),
  // loosen the regex to partial contains:
  // const or = specialties.map(sp => ({ specialization: { $regex: sp, $options: 'i' } }));

  return Doctor.find({ $or: or })
    .select('name specialization experience fee profileImage')
    .sort({ experience: -1 })
    .limit(limit);
}

module.exports = {
  analyzeSymptoms: async (userInput) => {
    const text = String(userInput || '');
    const low = text.toLowerCase();

    // Run your NLP
    const nlpResult = await nlpProcessor.processInput(text);
    const aiCondition = normalize(nlpResult?.condition);
    const aiSymptoms = Array.isArray(nlpResult?.symptoms) ? nlpResult.symptoms.map(normalize) : [];
    const symptomSet = new Set(aiSymptoms);

    // Heuristic match against KB
    const matchedConditions = [];

    // If the AI already classified a condition, seed it with a boost
    if (aiCondition && aiCondition !== 'uncertain' && aiCondition !== 'unknown') {
      const kbEntry = MEDICAL_KB[aiCondition] || { symptoms: [] };
      const overlap = kbEntry.symptoms.filter(s => symptomSet.has(normalize(s)));
      matchedConditions.push({
        condition: aiCondition,
        matchedSymptoms: overlap,
        confidence: 0.9, // boosted
        details: MEDICAL_KB[aiCondition] || { severity: 'unknown', recommendations: [], urgency: 'unknown' }
      });
    }

    // Also score all KB conditions by symptom overlap
    for (const [cond, data] of Object.entries(MEDICAL_KB)) {
      const overlap = data.symptoms
        .map(normalize)
        .filter(sym => symptomSet.has(sym));
      const conf = data.symptoms.length ? overlap.length / data.symptoms.length : 0;
      if (conf > 0) {
        matchedConditions.push({
          condition: cond,
          matchedSymptoms: overlap,
          confidence: conf,
          details: data
        });
      }
    }

    // Sort by confidence, keep unique by condition
    matchedConditions.sort((a, b) => b.confidence - a.confidence);
    const unique = [];
    const seen = new Set();
    for (const m of matchedConditions) {
      if (!seen.has(m.condition)) {
        unique.push(m);
        seen.add(m.condition);
      }
    }

    // Emergency detection
    const isEmergency = EMERGENCY_KEYWORDS.some(k => low.includes(k));

    // Decide specialties
    let specialties = [];
    if (isEmergency && (low.includes('chest pain') || low.includes('shortness of breath'))) {
      specialties = ['Cardiology', 'Emergency Medicine'];
    } else if (unique.length > 0) {
      const top = unique[0].condition;
      specialties = CONDITION_TO_SPECIALIZATIONS[top] || ['General Physician'];
    } else {
      specialties = ['General Physician']; // fallback for Unknown
    }

    // Fetch doctors
    let recommendedDoctors = [];
    try {
      recommendedDoctors = await findDoctorsBySpecialties(specialties, 20);
      // If nothing matched (naming mismatch), try a looser GP query
      if (recommendedDoctors.length === 0 && !specialties.includes('General Physician')) {
        recommendedDoctors = await findDoctorsBySpecialties(['General Physician'], 20);
      }
    } catch (e) {
      console.error('findDoctors error:', e);
      recommendedDoctors = [];
    }

    // Always return at least one "condition" entry
    const finalConditions = unique.length > 0
      ? unique
      : [{
          condition: 'Unknown condition',
          matchedSymptoms: [],
          confidence: 0,
          details: {
            severity: 'unknown',
            recommendations: ['Consult a doctor for further evaluation'],
            urgency: 'as soon as possible'
          }
        }];

    return {
      inputAnalysis: nlpResult,
      matchedConditions: finalConditions,
      isEmergency,
      specialties,
      recommendedDoctors,
      generalAdvice: isEmergency
        ? 'Seek immediate medical attention.'
        : 'Monitor symptoms and consult a doctor if they worsen.'
    };
  }
};
