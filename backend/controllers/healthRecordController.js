// backend/controllers/healthRecordController.js
const HealthRecord = require('../models/HealthRecord');
const Patient = require('../models/Patient');

/* ---------- helpers ---------- */
const getLoggedInUser = (req) =>
  req.user ||
  req.session?.user ||
  null;

const getUserId = (user) =>
  (user && (user._id || user.id)) ? String(user._id || user.id) : null;

/**
 * Patient: view all doctor notes for the logged-in patient
 * Renders: frontend/views/patient/health-records.ejs
 */
exports.getHealthRecords = async (req, res) => {
  try {
    const user = getLoggedInUser(req);
    const patientId = getUserId(user);
    if (!patientId) return res.status(401).send('Unauthorized');

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
    console.error('Error fetching health records:', err);
    return res.status(500).send('Server Error');
  }
};

/**
 * Doctor: add a new note for a patient
 * After saving, redirect to the doctor interface.
 */
exports.addDoctorNote = async (req, res) => {
  try {
    const user = getLoggedInUser(req);
    const doctorId = getUserId(user);
    if (!doctorId || user.role !== 'doctor') {
      return res.status(401).send('Unauthorized');
    }

    const { patientId, title, notes, appointmentId } = req.body;
    if (!patientId || !title || !notes) {
      return res.status(400).send('Missing required fields');
    }

    await HealthRecord.create({
      patient: patientId,
      doctor: doctorId,
      appointment: appointmentId || undefined,
      type: 'doctor_note',
      title,
      notes,
      visibility: 'both',
      addedByRole: 'doctor',
    });

    // stay on the DOCTOR-facing UI
    return res.redirect(`/health-records/patient/${patientId}`);
  } catch (err) {
    console.error('Error adding doctor note:', err);
    return res.status(500).send('Server Error');
  }
};

/**
 * Doctor/Admin: view notes for a patient (doctor template)
 * Renders: frontend/views/doctor/patient-records.ejs
 */
// Doctor/Admin: view notes for a patient (doctor OR admin template)
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

    // 👇 pick template by role
    const role =
      req.user?.role || req.session?.user?.role || 'guest';
    const template = role === 'admin'
      ? 'admin/patient-records'      // ✅ green admin page you created
      : 'doctor/patient-records';    // doctor page

    return res.render(template, {
      records,
      patientId,
      patientName: patient?.name || '',
      currentUser: req.user || req.session?.user || null,
    });
  } catch (err) {
    console.error('Error fetching patient notes for admin:', err);
    return res.status(500).send('Server Error');
  }
};


/**
 * Doctor/Admin: render the patient interface (read-only for doctor)
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
