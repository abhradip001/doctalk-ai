const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const { role } = require('../middlewares/roleMiddleware');

const {
  getHealthRecords,        // patient sees own notes
  addDoctorNote,           // doctor creates a note
  getPatientNotesForAdmin, // doctor/admin view a patient's notes (doctor template)
  viewAsPatient,           // 👈 doctor/admin view patient interface
} = require('../controllers/healthRecordController');

/* ---------- Patient ---------- */
// GET /health-records  -> logged-in patient sees their own notes
router.get('/', protect, role(['patient']), getHealthRecords);

/* ---------- Doctor ---------- */
// POST /health-records/doctor-note
router.post('/doctor-note', protect, role(['doctor']), addDoctorNote);

// Doctor view notes (doctor template)
router.get('/patient/:patientId', protect, role(['doctor']), getPatientNotesForAdmin);

// Doctor view notes but rendered with the patient template
router.get('/as-patient/:patientId', protect, role(['doctor','admin']), viewAsPatient);

/* ---------- Admin ---------- */
// Admin view notes (reuse doctor template or redirect to as-patient)
router.get('/admin/patient/:patientId', protect, role(['admin']), getPatientNotesForAdmin);

module.exports = router;
