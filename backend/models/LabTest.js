// models/LabTest.js
const mongoose = require('mongoose');

const LabTestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  testName: String,
  performedBy: String,
  recordDate: { type: Date, default: Date.now },
  notes: String,
  filename: String // stored filename, EJS uses it to create Download link
});

module.exports = mongoose.model('LabTest', LabTestSchema);
