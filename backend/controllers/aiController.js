const decisionEngine = require('../ai-modules/symptom-analysis/decisionEngine');

module.exports = {
  analyzeSymptoms: async (req, res) => {
    try {
      const { symptoms } = req.body;
      
      if (!symptoms || typeof symptoms !== 'string') {
        return res.status(400).json({ error: 'Symptoms description is required' });
      }
      
      const analysis = await decisionEngine.analyzeSymptoms(symptoms);
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error('AI Analysis Error:', error);
      res.status(500).json({ error: 'Failed to analyze symptoms' });
    }
  },
  
  chatWithAI: async (req, res) => {
    try {
      const { message, chatHistory = [] } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Process the message with context from chat history
      const response = await decisionEngine.analyzeSymptoms(message);
      
      // Format a friendly response
      let aiResponse = "Based on your symptoms, ";
      
      if (response.matchedConditions.length > 0) {
        const topCondition = response.matchedConditions[0];
        aiResponse += `you might be experiencing ${topCondition.condition}. `;
        aiResponse += `The most common symptoms are ${topCondition.details.symptoms.join(', ')}. `;
        aiResponse += `I recommend: ${topCondition.details.recommendations.join(', ')}.`;
      } else {
        aiResponse += "I couldn't identify a specific condition. ";
        aiResponse += "Please provide more details or consult with a doctor.";
      }
      
      if (response.isEmergency) {
        aiResponse = "⚠️ EMERGENCY: " + aiResponse;
      }
      
      res.json({
        success: true,
        response: aiResponse,
        analysis: response
      });
    } catch (error) {
      console.error('AI Chat Error:', error);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  }
};