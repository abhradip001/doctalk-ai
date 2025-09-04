// maps AI condition/symptoms to one or more medical specialties
module.exports = function specialtiesFor({ condition, symptoms = [] }) {
  const c = String(condition || '').toLowerCase();
  const s = new Set(symptoms.map(x => String(x).toLowerCase()));

  // helpers
  const has = (...keys) => keys.some(k => s.has(k));
  const list = (...xs) => [...new Set(xs.filter(Boolean))];

  // direct by condition
  if (['heart attack','myocardial_infarction','angina','chest pain'].includes(c) || has('chest pain')) {
    return ['Cardiology', 'Emergency Medicine'];
  }
  if (['asthma','bronchitis','pneumonia','copd'].includes(c) || has('shortness of breath','cough','wheezing')) {
    return ['Pulmonology', 'General Physician'];
  }
  if (['stroke','migraine','vertigo'].includes(c) || has('headache','dizziness')) {
    return ['Neurology'];
  }
  if (['diabetes'].includes(c) || has('extreme thirst','frequent urination','blurred vision','fatigue')) {
    return ['Endocrinology', 'General Physician'];
  }
  if (['gastritis','ulcer','appendicitis','indigestion','food poisoning','digestive'].includes(c) || has('abdominal pain','stomach')) {
    return ['Gastroenterology', 'General Surgery'];
  }
  if (['arthritis','gout','sprain','joint pain'].includes(c) || has('joint','swelling')) {
    return ['Orthopedics', 'Rheumatology'];
  }
  if (['skin infection','allergy','eczema','measles','rash'].includes(c) || has('rash','skin infection')) {
    return ['Dermatology'];
  }
  if (['tonsillitis','strep throat','laryngitis','sore throat'].includes(c) || has('throat','sore throat')) {
    return ['ENT'];
  }
  if (['conjunctivitis','glaucoma','cataract','eye infection'].includes(c) || has('eye','red itchy eyes')) {
    return ['Ophthalmology'];
  }
  if (['ear infection','otitis_media','hearing loss'].includes(c) || has('ear pain')) {
    return ['ENT'];
  }

  // fallback
  return ['General Physician'];
};
