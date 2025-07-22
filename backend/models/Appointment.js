// backend/models/Appointment.js

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    time: Date,
    meetingLink: String
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
