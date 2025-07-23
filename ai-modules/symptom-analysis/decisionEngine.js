const nlpProcessor = require('./nlpProcessor');
const Doctor = require('../../backend/models/Doctor'); // ✅ correct import

const MEDICAL_KB = {
  'flu': {
    symptoms: ['fever', 'headache', 'cough', 'fatigue'],
    severity: 'moderate',
    recommendations: ['rest', 'hydration', 'antipyretics'],
    urgency: 'within 24 hours'
  },
  'respiratory': {
    symptoms: ['cough', 'shortness of breath', 'chest pain'],
    severity: 'high',
    recommendations: ['seek medical attention', 'chest x-ray'],
    urgency: 'immediate'
  }
};

module.exports = {
  analyzeSymptoms: async (userInput) => {
    const nlpResult = nlpProcessor.processInput(userInput);

    const matchedConditions = [];
    for (const [condition, data] of Object.entries(MEDICAL_KB)) {
      const matchedSymptoms = data.symptoms.filter(symptom => 
        nlpResult.symptoms.includes(symptom));
      if (matchedSymptoms.length > 0) {
        matchedConditions.push({
          condition,
          matchedSymptoms,
          confidence: matchedSymptoms.length / data.symptoms.length,
          details: data
        });
      }
    }

    matchedConditions.sort((a, b) => b.confidence - a.confidence);

    const emergencyKeywords = ['chest pain', 'difficulty breathing', 'severe pain'];
    const isEmergency = emergencyKeywords.some(keyword => 
      userInput.toLowerCase().includes(keyword));

    let recommendedDoctors = [];
    if (matchedConditions.length > 0) {
      const topCondition = matchedConditions[0].condition;
      recommendedDoctors = await Doctor.find({ specialization: topCondition }); // ✅ fixed
    }

    return {
      inputAnalysis: nlpResult,
      matchedConditions,
      isEmergency,
      recommendedDoctors,
      generalAdvice: isEmergency 
        ? 'Seek immediate medical attention' 
        : 'Monitor symptoms and consult a doctor if they worsen'
    };
  }
};
