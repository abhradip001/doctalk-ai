// models/LabTestRequest.js
const mongoose = require('mongoose');

const LabTestRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },

  // what the patient wants
  testName: { type: String, required: true },
  notes: { type: String, default: '' },

  // patient’s preferred schedule & pickup info
  preferredDate: { type: Date, required: true },
  preferredTimeFrom: { type: String, required: true }, // "09:00"
  preferredTimeTo: { type: String, required: true },   // "11:00"
  pickupAddress: { type: String, required: true },
  contactPhone: { type: String, required: true },

  // admin workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'scheduled', 'collected', 'reported', 'rejected'],
    default: 'pending'
  },

  // assignment details (who will collect)
  assignedEmployee: {
    name: String,
    phone: String,
    employeeId: String,
    visitDate: Date,  // actual scheduled pickup
    visitTime: String // e.g., "10:30"
  },

  // report
  reportFilename: { type: String, default: null },  // stored under /uploads/lab-tests
  reportUploadedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('LabTestRequest', LabTestRequestSchema);
