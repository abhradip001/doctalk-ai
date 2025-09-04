// backend/routes/doctorRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');

const Doctor = require('../models/Doctor');
const { protect, isDoctor } = require('../middlewares/authMiddleware');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');

const router = express.Router();

/* -------------------- helpers -------------------- */
const esc = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ciEmailRegex = (email = '') => new RegExp(`^${esc(String(email).trim())}$`, 'i');

/* -------------------- MULTER STORAGE: PROFILE & DEGREE -------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'profileImage') cb(null, 'uploads/profileImages/');
    else if (file.fieldname === 'degreeFile') cb(null, 'uploads/degrees/');
    else cb(null, 'uploads/');
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

/* -------------------- MULTER: PRESCRIPTIONS -------------------- */
const prescriptionStorage = multer.diskStorage({
  destination: 'uploads/prescriptions/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const fileFilter = (_req, file, cb) => {
  const allowed = /pdf|jpg|jpeg|png/;
  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  cb(allowed.test(ext) ? null : new Error('Only PDF, JPG, JPEG, PNG allowed'), allowed.test(ext));
};
const prescriptionUpload = multer({
  storage: prescriptionStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* -------------------- DOCTOR REGISTRATION -------------------- */
router.get('/register', (_req, res) => {
  res.render('auth/register-doctor', { error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingDoctor = await Doctor.findOne({
      email: { $regex: ciEmailRegex(email) },
    });
    if (existingDoctor) {
      return res
        .status(400)
        .render('auth/register-doctor', { error: 'Doctor already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const doctor = new Doctor({ name, email, phone, password: hashedPassword });
    await doctor.save();
    res.redirect('/auth/login');
  } catch (error) {
    res
      .status(500)
      .render('auth/register-doctor', { error: 'Server Error: ' + error.message });
  }
});

/* -------------------- DOCTOR LIST (Patient View) -------------------- */
router.get('/doctorList', async (req, res) => {
  try {
    const query = {};
    if (req.query.specialization) query.specialization = req.query.specialization;
    if (req.query.experience) query.experience = { $gte: Number(req.query.experience) };

    const doctors = await Doctor.find(query);
    res.render('patient/doctorList', { doctors });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading doctor list');
  }
});

/* -------------------- DOCTOR DASHBOARD -------------------- */
router.get('/dashboard', protect, isDoctor, async (req, res) => {
  const { id, email } = req.session.user || {};

  // Fetch the logged-in doctor
  let doctor = null;
  if (id) doctor = await Doctor.findById(id);
  if (!doctor && email) doctor = await Doctor.findOne({ email: { $regex: ciEmailRegex(email) } });

  // Build a unique patient list from this doctor's appointments
  const appts = await Appointment.find({ doctorId: id || doctor?._id })
    .populate('patientId', 'name age email phone') // keep payload light
    .sort({ createdAt: -1 });

  const seen = new Set();
  const patients = [];
  for (const a of appts) {
    if (a.patientId) {
      const key = String(a.patientId._id);
      if (!seen.has(key)) {
        seen.add(key);
        patients.push(a.patientId);
      }
    }
  }

  // Pass patients (even if empty) and optional notfound flag
  res.render('doctor/dashboard', {
    doctor: doctor || {},
    patients,
    notfound: req.query.notfound,
  });
});

/* -------------------- PROFILE (View/Read + Edit) -------------------- */
router.get('/profile', protect, isDoctor, async (req, res) => {
  const { id, email } = req.session.user || {};
  let doctor = null;
  if (id) doctor = await Doctor.findById(id);
  if (!doctor && email) doctor = await Doctor.findOne({ email: { $regex: ciEmailRegex(email) } });

  const mode = req.query.edit === '1' ? 'edit' : 'read';
  const saved = req.query.saved === '1';
  res.render('doctor/profile', { doctor: doctor || {}, mode, saved });
});

// Convenience: /doctor/profile/edit -> ?edit=1
router.get('/profile/edit', protect, isDoctor, (_req, res) => {
  return res.redirect('/doctor/profile?edit=1');
});

router.post(
  '/profile',
  protect,
  isDoctor,
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'degreeFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) return res.status(401).send('Unauthorized');

      const { specialization, experience, fee, days, startTime, endTime } = req.body;

      // Normalize days to array
      const daysArr = Array.isArray(days) ? days.filter(Boolean) : days ? [days] : [];

      const updateData = {
        specialization,
        experience: Number(experience) || 0,
        fee: Number(fee) || 0,
        availability: {
          days: daysArr,
          startTime: startTime || '',
          endTime: endTime || '',
        },
      };

      if (req.files?.profileImage?.[0]) {
        updateData.profileImage = 'uploads/profileImages/' + req.files.profileImage[0].filename;
      }
      if (req.files?.degreeFile?.[0]) {
        updateData.degreeFile = 'uploads/degrees/' + req.files.degreeFile[0].filename;
      }

      await Doctor.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
      return res.redirect('/doctor/profile?saved=1');
    } catch (err) {
      console.error('Profile Update Error:', err);
      return res.status(500).send('Server Error');
    }
  }
);

/* -------------------- APPOINTMENTS (LIST + STATUS UPDATE) -------------------- */
router.get('/appointments', protect, isDoctor, async (req, res) => {
  const userId = req.session.user.id;
  const appointments = await Appointment.find({ doctorId: userId })
    .populate('patientId', 'name email phone');
  res.render('doctor/appointments', { appointments });
});

router.post('/appointments/:id/approve', protect, isDoctor, async (req, res) => {
  const userId = req.session.user.id;
  await Appointment.findOneAndUpdate(
    { _id: req.params.id, doctorId: userId },
    { status: 'Approved' }
  );
  res.redirect('/doctor/appointments');
});

router.post('/appointments/:id/cancel', protect, isDoctor, async (req, res) => {
  const userId = req.session.user.id;
  await Appointment.findOneAndUpdate(
    { _id: req.params.id, doctorId: userId },
    { status: 'Cancelled' }
  );
  res.redirect('/doctor/appointments');
});

/* -------------------- QUICK OPEN: PATIENT BY NAME -------------------- */
// form: GET /doctor/open-patient-by-name?name=Patients1
router.get('/open-patient-by-name', protect, isDoctor, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.redirect('/doctor/dashboard');

  // exact match first, then partial (both case-insensitive)
  const exact = await Patient.findOne({ name: new RegExp('^' + esc(name) + '$', 'i') }).select('_id');
  let patient = exact;
  if (!patient) {
    patient = await Patient.findOne({ name: new RegExp(esc(name), 'i') }).select('_id');
  }

  if (!patient) return res.redirect('/doctor/dashboard?notfound=1');
  return res.redirect(`/health-records/patient/${patient._id}`);
});

/* -------------------- PRESCRIPTION UPLOAD -------------------- */
router.get('/upload-prescription', protect, isDoctor, async (_req, res) => {
  const patients = await Patient.find().select('name'); // small payload
  res.render('doctor/uploadPrescription', { patients });
});

router.post(
  '/upload-prescription',
  protect,
  isDoctor,
  prescriptionUpload.single('prescription'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { patientId } = req.body;

      if (!req.file) {
        return res.status(400).send('No file uploaded or invalid file type');
      }

      const prescription = new Prescription({
        doctorId: userId,
        patientId,
        filePath: req.file.path,
      });

      await prescription.save();
      res.redirect('/doctor/dashboard');
    } catch (error) {
      console.error('Prescription Upload Error:', error.message);
      res.status(500).send('Server Error: ' + error.message);
    }
  }
);

module.exports = router;
