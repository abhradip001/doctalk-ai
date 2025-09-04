// backend/routes/patientRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');

const LabTest = require('../models/LabTest');
const LabTestRequest = require('../models/LabTestRequest');

const { protect } = require('../middlewares/authMiddleware');
const { ensurePayment } = require('../middlewares/paymentMiddleware');
const { getPrescriptions } = require('../controllers/patientController');

// ✅ NEW: use the controller for doctor-note health records
const { getHealthRecords } = require('../controllers/healthRecordController');

const router = express.Router();

/* -------------------- Helpers -------------------- */
function currentPatientId(req) {
  return (
    req.session?.user?.id ||
    req.user?._id ||
    req.user?.id ||
    null
  );
}

/* -------------------- Registration -------------------- */
router.get('/register', (req, res) => {
  res.render('auth/register-patient', { error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, age, password } = req.body;
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      return res.status(400).render('auth/register-patient', { error: 'Patient already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const patient = new Patient({ name, email, phone, age, password: hashedPassword });
    await patient.save();
    res.redirect('/auth/login');
  } catch (error) {
    res.status(500).render('auth/register-patient', { error: 'Server Error: ' + error.message });
  }
});

/* -------------------- Doctor List -------------------- */
router.get('/doctorList', protect, ensurePayment, async (req, res) => {
  try {
    const { specialization, experience } = req.query;
    const filter = {};
    if (specialization) filter.specialization = specialization;
    if (experience) filter.experience = { $gte: Number(experience) };

    const doctors = await Doctor.find(filter);
    res.render('patient/doctorList', { doctors });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).send('Server Error');
  }
});

/* -------------------- Health Records (Doctor Notes only) -------------------- */
// Renders patient/health-records.ejs with { records }
router.get('/health-records', protect, ensurePayment, getHealthRecords);

// ❌ Removed legacy upload endpoints & multer setup since we no longer upload files
// router.post('/health-records/upload', ...)

/* -------------------- Lab Tests -------------------- */
router.get('/lab-tests', protect, ensurePayment, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    if (!pid) return res.status(401).send('Please log in again.');

    const records = await LabTest.find({ patientId: pid })
      .sort({ recordDate: -1 })
      .lean();
    res.render('patient/lab-tests', { records });
  } catch (err) {
    console.error('Error loading lab tests:', err);
    res.status(500).send('Error loading lab tests');
  }
});

// Form to request a lab test with home pickup
router.get('/lab-tests/request/new', protect, ensurePayment, (req, res) => {
  res.render('patient/labTestRequestNew', { error: null });
});

// Create a lab test request
router.post('/lab-tests/request', protect, ensurePayment, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    if (!pid) {
      return res.status(401).render('patient/labTestRequestNew', { error: 'Please log in again (missing patientId).' });
    }

    const {
      testName, notes,
      preferredDate, preferredTimeFrom, preferredTimeTo,
      pickupAddress, contactPhone,
    } = req.body;

    await LabTestRequest.create({
      patientId: pid,
      testName, notes,
      preferredDate, preferredTimeFrom, preferredTimeTo,
      pickupAddress, contactPhone,
    });

    res.redirect('/patient/lab-tests/requests/my');
  } catch (e) {
    console.error('Create LabTestRequest error:', e);
    res.status(500).render('patient/labTestRequestNew', { error: e.message });
  }
});

// List my lab test requests
router.get('/lab-tests/requests/my', protect, ensurePayment, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    if (!pid) return res.status(401).send('Please log in again.');

    const requests = await LabTestRequest.find({ patientId: pid })
      .sort({ createdAt: -1 })
      .lean();
    res.render('patient/labTestRequestsMy', { requests });
  } catch (err) {
    console.error('List LabTestRequests error:', err);
    res.status(500).send('Error loading requests');
  }
});

/* -------------------- Prescriptions -------------------- */
router.get('/prescriptions', protect, ensurePayment, getPrescriptions);

/* -------------------- Payment Submit -------------------- */
router.post('/submit-subscription-payment', protect, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    const { transactionId, amount } = req.body;

    const payment = new Payment({
      patientId: pid,
      transactionId,
      amount,
      status: 'pending',
    });
    await payment.save();

    res.render('patient/payment-success', {
      message: 'Payment submitted for admin review. Features unlock after approval.',
    });
  } catch (err) {
    console.error('Payment Save Error:', err);
    res.status(500).send('Payment processing error');
  }
});

/* -------------------- Payment Success -------------------- */
router.get('/payment-success', protect, (req, res) => {
  res.render('patient/payment-success');
});

/* -------------------- Appointments -------------------- */
router.get('/appointment/:doctorId', protect, ensurePayment, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) return res.status(404).send('Doctor not found');
    res.render('patient/appointment', { doctor });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.post('/book-appointment', protect, ensurePayment, async (req, res) => {
  const pid = currentPatientId(req);
  const { doctorId, selectedDay, selectedTime } = req.body;
  await Appointment.create({
    patientId: pid,
    doctorId,
    date: `${selectedDay} - ${selectedTime}`,
    status: 'Pending',
  });
  res.redirect('/patient/my-appointments');
});

// View all appointments for logged-in patient
router.get('/my-appointments', protect, ensurePayment, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    const appointments = await Appointment.find({ patientId: pid })
      .populate('doctorId', 'name specialization')
      .sort({ createdAt: -1 });
    res.render('patient/myAppointments', { appointments });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching appointments');
  }
});

/* -------------------- Profile -------------------- */
router.get('/profile', protect, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    const patient = await Patient.findById(pid);
    const mode = req.query.edit === '1' ? 'edit' : 'read';
    const saved = req.query.saved === '1';
    res.render('patient/profile', { patient: patient || {}, mode, saved });
  } catch (err) {
    console.error('Error loading patient profile:', err);
    res.status(500).send('Error loading profile');
  }
});

router.post('/profile', protect, async (req, res) => {
  try {
    const pid = currentPatientId(req);
    const { name, age, sex, bloodGroup, phone, address } = req.body;

    await Patient.findByIdAndUpdate(
      pid,
      { name, age, sex, bloodGroup, phone, address },
      { new: true }
    );

    res.redirect('/patient/profile?saved=1');
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).send('Error updating profile');
  }
});

module.exports = router;
