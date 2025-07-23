const nlpProcessor = require('./nlpProcessor');
const Doctor = require('../../backend/models/Doctor');
 // Assuming you have a database connection

// Medical knowledge base
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
  },
  // Add more conditions as needed
};

module.exports = {
  analyzeSymptoms: async (userInput) => {
    // Process the input with NLP
    const nlpResult = nlpProcessor.processInput(userInput);
    
    // Match against medical knowledge base
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
    
    // Sort by confidence
    matchedConditions.sort((a, b) => b.confidence - a.confidence);
    
    // Check for emergencies
    const emergencyKeywords = ['chest pain', 'difficulty breathing', 'severe pain'];
    const isEmergency = emergencyKeywords.some(keyword => 
      userInput.toLowerCase().includes(keyword));
    
    // Get doctor recommendations from database
    let recommendedDoctors = [];
    if (matchedConditions.length > 0) {
      const topCondition = matchedConditions[0].condition;
      recommendedDoctors = await medicalDatabase.getDoctorsBySpecialty(topCondition);
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
