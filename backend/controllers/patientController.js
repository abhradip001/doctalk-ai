const Doctor = require('../models/Doctor');
const Prescription = require('../models/Prescription');  // Added
const HealthRecord = require('../models/HealthRecord');

// Show doctor list with optional filtering
exports.getDoctorList = async (req, res) => {
  try {
    const { specialization, experience } = req.query;

    // Build filter dynamically
    const filter = {};
    if (specialization) filter.specialization = specialization;
    if (experience) filter.experience = { $gte: Number(experience) };

    const doctors = await Doctor.find(filter);
    res.render('patient/doctorList', { doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).send('Server Error');
  }
};

// Lab tests 
exports.getLabTests = async (req, res) => {
  try {
    const records = await HealthRecord.find({
      patientId: req.session.user.id,
      type: 'lab'
    }).sort({ recordDate: -1 });
    res.render('patient/lab-tests', { records });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// Prescriptions (NEW: fetches doctor-uploaded prescriptions)
exports.getPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({
      patientId: req.session.user.id
    }).populate('doctorId', 'name specialization email');

    res.render('patient/prescriptions', { prescriptions });
  } catch (err) {
    console.error('Error fetching prescriptions:', err);
    res.status(500).send('Server Error');
  }
};
