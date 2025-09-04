const mongoose = require('mongoose');

const ChatLearningSchema = new mongoose.Schema({
  originalText: { type: String, required: true },
  translatedText: { type: String },
  detectedLanguage: { type: String },
  timestamp: { type: Date, default: Date.now },
  newSymptoms: [{ type: String }]
});

module.exports = mongoose.model('ChatLearning', ChatLearningSchema);
