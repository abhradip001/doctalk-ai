const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PatientSchema = new Schema({
    name: { type: String, required: true },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    phone: {
        type: String,
        required: true,
        match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
    },
    address: String,
    dob: Date,
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    medicalHistory: { type: [String], default: [] },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    registrationDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Patient', PatientSchema);
