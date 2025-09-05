// backend/routes/healthRecordRoutes.js
const router = require('express').Router();

const { protect, isDoctor, isAdmin } = require('../middlewares/authMiddleware');
const { role } = require('../middlewares/roleMiddleware');

const {
  getHealthRecords,        // patient sees own notes (patient template)
  addDoctorNote,           // doctor creates a note
  getPatientNotesForAdmin, // doctor/admin view a patient's notes (doctor template)
  viewAsPatient,           // doctor/admin view patient interface (patient template)
} = require('../controllers/healthRecordController');

/* -------------------- Patient (self) -------------------- */
// GET /health-records  -> logged-in patient sees their own notes
router.get('/', protect, role(['patient']), getHealthRecords);

/* -------------------- Doctor -------------------- */
// POST /health-records/doctor-note  -> create a doctor note
// Use isDoctor (session-aware) to avoid false Unauthorized on POST
router.post('/doctor-note', protect, isDoctor, addDoctorNote);

// GET /health-records/patient/:patientId  -> doctor UI for a patient's notes
router.get('/patient/:patientId', protect, isDoctor, getPatientNotesForAdmin);

// GET /health-records/as-patient/:patientId -> render patient-style view (read as patient)
router.get('/as-patient/:patientId', protect, (req, res, next) => {
  if (req.user && (req.user.role === 'doctor' || req.user.role === 'admin')) return next();
  return res.status(403).send('Forbidden');
}, viewAsPatient);

/* -------------------- Admin -------------------- */
// GET /health-records/admin/patient/:patientId -> admin sees doctor template
router.get('/admin/patient/:patientId', protect, isAdmin, getPatientNotesForAdmin);

module.exports = router;
