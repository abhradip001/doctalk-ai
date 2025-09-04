// backend/models/ChatMessage.js
const mongoose = require('mongoose');

const ChatLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
  userRole: { type: String, enum: ['patient','doctor','admin','guest'], default: 'patient' },
  from: { type: String, enum: ['patient','ai'], required: true },
  message: { type: String, required: true },
  lang: { type: String, default: 'en' },
  intent: { type: String, default: 'symptom-checker' },
}, { timestamps: true });

module.exports = mongoose.model('ChatLog', ChatLogSchema, 'chatmessages');
