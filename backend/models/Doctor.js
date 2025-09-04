const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    specialization: { type: String, default: '' },
    experience: { type: Number, default: 0 },    // <-- ADD THIS
    fee: { type: Number, default : 0},
    createdAt: { type: Date, default: Date.now },
    availability: {
    days: [String],
    startTime: String,
    endTime: String
    },
    profileImage: { type: String },
    degreeFile: { type: String } // path to uploaded file


});


module.exports = mongoose.model('Doctor', DoctorSchema);
