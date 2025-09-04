// backend/models/HealthRecord.js
const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema(
  {
    // Required: whose record this is
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },

    // Optional: who wrote it
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      index: true,
    },

    // Optional: tie the note to a specific visit
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      index: true,
    },

    // Only one manual type you asked for
    type: {
      type: String,
      enum: ['doctor_note'],
      default: 'doctor_note',
      required: true,
      index: true,
    },

    // Human-friendly short label in the list (e.g., “Follow-up advice”)
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      required: true,
    },

    // The actual note
    notes: {
      type: String,
      trim: true,
      required: true,
    },

    // Who can see it (optional; default both)
    visibility: {
      type: String,
      enum: ['patient', 'doctor', 'both'],
      default: 'both',
    },

    // Audit helper
    addedByRole: {
      type: String,
      enum: ['doctor', 'admin'],
      required: true,
    },

    // Soft delete (handy if you need)
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Useful compound index for fast timelines
healthRecordSchema.index({ patient: 1, createdAt: -1, isDeleted: 1 });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
