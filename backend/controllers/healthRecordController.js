// backend/controllers/healthRecordController.js
const HealthRecord = require('../models/HealthRecord');
const Patient = require('../models/Patient');

/**
 * Patient: view all doctor notes for the logged-in patient
 * Renders: frontend/views/patient/health-records.ejs
 */
exports.getHealthRecords = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).send('Unauthorized');

    const [records, patient] = await Promise.all([
      HealthRecord.find({
        patient: req.user._id,
        type: 'doctor_note',
        isDeleted: false,
      })
        .populate('doctor', 'name specialization')
        .sort({ createdAt: -1 }),
      // optional: if your patient template shows basic info
      Patient.findById(req.user._id).select('name age sex bloodGroup email phone address'),
    ]);

    return res.render('patient/health-records', {
      records,
      patient,              // patient info for header (optional in your EJS)
      patientId: req.user._id, // handy if your template needs it
    });
  } catch (err) {
    console.error('Error fetching health records:', err);
    return res.status(500).send('Server Error');
  }
};

/**
 * Doctor: add a new note for a patient
 * After saving, redirect to the **patient interface** (view-as-patient).
 */
exports.addDoctorNote = async (req, res) => {
  try {
    const { patientId, title, notes, appointmentId } = req.body;
    if (!req.user?._id) return res.status(401).send('Unauthorized');

    await HealthRecord.create({
      patient: patientId,
      doctor: req.user._id,
      appointment: appointmentId || undefined,
      type: 'doctor_note',
      title,
      notes,
      visibility: 'both',
      addedByRole: 'doctor',
    });

    // 👉 land on the patient-facing UI
    return res.redirect(`/health-records/as-patient/${patientId}`);
  } catch (err) {
    console.error('Error adding doctor note:', err);
    return res.status(500).send('Server Error');
  }
};

/**
 * Doctor/Admin: view notes for a patient (doctor template)
 * Renders: frontend/views/doctor/patient-records.ejs
 */
exports.getPatientNotesForAdmin = async (req, res) => {
  try {
    const { patientId } = req.params;

    const [records, patient] = await Promise.all([
      HealthRecord.find({
        patient: patientId,
        type: 'doctor_note',
        isDeleted: false,
      })
        .populate('doctor', 'name specialization')
        .sort({ createdAt: -1 }),
      Patient.findById(patientId).select('name'),
    ]);

    return res.render('doctor/patient-records', {
      records,
      patientId,
      patientName: patient?.name || '',
    });
  } catch (err) {
    console.error('Error fetching patient notes for admin:', err);
    return res.status(500).send('Server Error');
  }
};

/**
 * Doctor/Admin: render the **patient interface** for a given patient
 * Renders: frontend/views/patient/health-records.ejs
 */
exports.viewAsPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const [records, patient] = await Promise.all([
      HealthRecord.find({
        patient: patientId,
        type: 'doctor_note',
        isDeleted: false,
      })
        .populate('doctor', 'name specialization')
        .sort({ createdAt: -1 }),
      Patient.findById(patientId).select('name age sex bloodGroup email phone address'),
    ]);

    return res.render('patient/health-records', {
      records,
      patient,
      patientId,
    });
  } catch (err) {
    console.error('Error in viewAsPatient:', err);
    return res.status(500).send('Server Error');
  }
};
