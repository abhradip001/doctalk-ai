// backend/routes/adminRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const Admin = require('../models/Admin');
const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');

// ✅ Use ChatLog (collection: chatmessages) — file is ChatMessage.js but exports ChatLog
const ChatLog = require('../models/ChatMessage');

const { protect, isAdmin } = require('../middlewares/authMiddleware'); // optional
const adminController = require('../controllers/adminController');

const router = express.Router();

// -------- New: uploads + lab-test requests --------
const multer = require('multer');
const LabTestRequest = require('../models/LabTestRequest');
const LabTest = require('../models/LabTest');

// If you want to protect all admin routes, uncomment:
// router.use(protect, isAdmin);

/* -------------------- ADMIN REGISTRATION -------------------- */
router.get('/register', (req, res) => {
  res.render('auth/register-admin', { error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, secretKey } = req.body;

    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).render('auth/register-admin', { error: 'Invalid secret key' });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).render('auth/register-admin', { error: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ name, email, phone, password: hashedPassword });
    await admin.save();

    res.redirect('/auth/login');
  } catch (error) {
    res.status(500).render('auth/register-admin', { error: 'Server Error: ' + error.message });
  }
});

/* -------------------- PAYMENTS -------------------- */
router.get('/payments', async (req, res) => {
  const pendingPayments = await Payment.find({ status: 'pending' }).populate('patientId');
  res.render('admin/payments', { payments: pendingPayments });
});

router.post('/payments/approve/:id', async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (payment) {
    payment.status = 'success';
    await payment.save();
    await Patient.findByIdAndUpdate(payment.patientId, { hasPaid: true });
  }
  res.redirect('/admin/payments');
});

router.post('/payments/reject/:id', async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (payment) {
    payment.status = 'rejected';
    await payment.save();
  }
  res.redirect('/admin/payments');
});

// (Optional) Mark doctor paid
if (adminController && typeof adminController.markDoctorPaid === 'function') {
  router.post('/payments/:paymentId/mark-doctor-paid', adminController.markDoctorPaid);
} else {
  router.post('/payments/:paymentId/mark-doctor-paid', (req, res) => res.redirect('/admin/payments'));
}

/* -------------------- DASHBOARD -------------------- */
router.get('/dashboard', async (req, res) => {
  const doctorCount = await Doctor.countDocuments();
  const patientCount = await Patient.countDocuments();
  const pendingPayments = await Payment.countDocuments({ status: 'pending' });
  res.render('admin/dashboard', { doctorCount, patientCount, pendingPayments });
});

/* -------------------- DOCTOR MANAGEMENT -------------------- */
router.get('/doctors', async (req, res) => {
  const doctors = await Doctor.find();
  res.render('admin/manageDoctors', { doctors });
});

router.post('/doctors/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Doctor.findById(id);
    if (!doc) return res.redirect('/admin/doctors?msg=Doctor+not+found');

    const removeIfExists = (p) => {
      if (!p) return;
      const abs = path.join(process.cwd(), p.replace(/^\//, ''));
      if (fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch { /* ignore */ }
      }
    };
    removeIfExists(doc.profileImage);
    removeIfExists(doc.degreeFile);

    await Appointment.deleteMany({ doctorId: id });
    await Prescription.deleteMany({ doctorId: id });
    await Doctor.findByIdAndDelete(id);

    return res.redirect('/admin/doctors?msg=Doctor+deleted');
  } catch (err) {
    console.error('Delete doctor error:', err);
    return res.redirect('/admin/doctors?msg=Delete+failed');
  }
});

/* -------------------- PATIENT MANAGEMENT -------------------- */
router.get('/patients', async (req, res) => {
  const patients = await Patient.find({});
  res.render('admin/managePatients', { title: 'Manage Patients', patients });
});

router.post('/patients/delete/:id', async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.redirect('/admin/patients');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting patient');
  }
});

/* -------------------- APPOINTMENTS -------------------- */
router.get('/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name specialization email')
      .sort({ date: -1 });

    res.render('admin/manageAppointments', { appointments });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).send('Error loading appointments');
  }
});

router.post('/appointments/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, dateTime } = req.body;
  if (!['Approved', 'Cancelled'].includes(status)) {
    return res.status(400).send('Invalid status');
  }

  const update = { status };
  if (dateTime) {
    const d = new Date(dateTime);
    if (!isNaN(d.getTime())) update.date = d;
  }

  await Appointment.findByIdAndUpdate(id, update, { new: true });
  res.redirect('/admin/appointments');
});

router.post('/appointments/:id/add-link', async (req, res) => {
  try {
    const { id } = req.params;
    const { meetingLink } = req.body;
    await Appointment.findByIdAndUpdate(id, { meetingLink }, { new: true });
    return res.redirect('/admin/appointments');
  } catch (err) {
    console.error('add link error:', err);
    return res.status(500).send('Failed to add meeting link');
  }
});

router.post('/appointments/:id/delete', async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    return res.redirect('/admin/appointments');
  } catch (err) {
    console.error('delete appointment error:', err);
    return res.status(500).send('Failed to delete appointment');
  }
});

/* -------------------- CHAT LOGS (AI Symptom Checker history) -------------------- */
/**
 * GET /admin/chat-logs
 * Query params (optional):
 *   - q        : search patient name/email (fuzzy)
 *   - patient  : specific patientId
 *   - sender   : 'patient' | 'ai'
 *   - from     : YYYY-MM-DD (start)
 *   - to       : YYYY-MM-DD (end)
 *   - page     : page number (default 1)
 *   - limit    : page size (default 20, cap 100)
 *   - order    : 'asc' | 'desc' (default 'desc')
 */
router.get('/chat-logs', async (req, res) => {
  try {
    const {
      q = '',
      patient = '',
      sender = '',
      from = '',
      to = '',
      page = 1,
      limit = 20,
      order = 'desc',
    } = req.query;

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const sortDirection = order === 'asc' ? 1 : -1; // ✅ define it

    const andFilters = [{ userRole: 'patient' }];

    if (patient) {
      andFilters.push({ userId: patient });
    }

    if (sender) {
      andFilters.push({ from: sender }); // 'patient' | 'ai'
    }

    if (from || to) {
      const start = from ? new Date(from) : new Date('1970-01-01');
      const end = to ? new Date(to) : new Date();
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        andFilters.push({ createdAt: { $gte: start, $lte: end } });
      }
    }

    if (q) {
      const rx = new RegExp(q, 'i');
      const matchingPatients = await Patient.find({ $or: [{ name: rx }, { email: rx }] }).select('_id');
      const ids = matchingPatients.map(p => p._id);
      if (ids.length) {
        andFilters.push({ userId: { $in: ids } });
      } else {
        const patientsList = await Patient.find().select('name email');
        return res.render('admin/chatLogs', {
          title: 'Chat Logs',
          logs: [],
          patients: patientsList,
          filters: { q, patient, sender, from, to, page: pg, limit: lim, order },
          total: 0,
          pages: 0,
        });
      }
    }

    const query = andFilters.length === 1 ? andFilters[0] : { $and: andFilters };

    const total = await ChatLog.countDocuments(query);
    const logs = await ChatLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: sortDirection }) // ✅ now defined
      .skip((pg - 1) * lim)
      .limit(lim);

    const patientsList = await Patient.find().select('name email');

    res.render('admin/chatLogs', {
      title: 'Chat Logs',
      logs,
      patients: patientsList,
      filters: { q, patient, sender, from, to, page: pg, limit: lim, order },
      total,
      pages: Math.ceil(total / lim),
    });
  } catch (err) {
    console.error('Error loading chat logs:', err);
    res.status(500).send('Error loading chat logs');
  }
});

// ✅ Delete a single chat log (used by EJS form if present)
router.post('/chat-logs/:id/delete', async (req, res) => {
  try {
    await ChatLog.findByIdAndDelete(req.params.id);
    return res.redirect('/admin/chat-logs');
  } catch (e) {
    console.error('delete chat log error:', e);
    return res.status(500).send('Failed to delete log');
  }
});

/* -------------------- LAB TEST REQUESTS (Home Collection Flow) -------------------- */
// Storage for final reports (publicly served under /uploads/lab-tests)
const labTestStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/lab-tests'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const uploadLabReport = multer({ storage: labTestStorage });

// 1) List all requests (pending, scheduled, collected, reported, rejected)
router.get('/lab-test-requests', /*protect, isAdmin,*/ async (req, res) => {
  try {
    const requests = await LabTestRequest.find()
      .populate('patientId', 'name email phone')
      .sort({ createdAt: -1 });

    res.render('admin/labTestRequests', { requests });
  } catch (err) {
    console.error('Error loading lab test requests:', err);
    res.status(500).send('Error loading lab test requests');
  }
});

// 2) Approve & assign employee (phlebotomist) + schedule home visit
router.post('/lab-test-requests/:id/approve', /*protect, isAdmin,*/ async (req, res) => {
  try {
    const { employeeName, employeePhone, employeeId, visitDate, visitTime } = req.body;
    const r = await LabTestRequest.findById(req.params.id);
    if (!r) return res.status(404).send('Request not found');

    r.status = 'scheduled';
    r.assignedEmployee = {
      name: employeeName,
      phone: employeePhone,
      employeeId,
      visitDate: visitDate ? new Date(visitDate) : null,
      visitTime: visitTime || null,
    };
    await r.save();

    // TODO: send SMS/email to patient with assignment (optional)
    res.redirect('/admin/lab-test-requests');
  } catch (err) {
    console.error('Approve/assign error:', err);
    res.status(500).send('Failed to approve and assign');
  }
});

// (Optional) Mark as collected (after visit)
router.post('/lab-test-requests/:id/collected', /*protect, isAdmin,*/ async (req, res) => {
  try {
    const r = await LabTestRequest.findById(req.params.id);
    if (!r) return res.status(404).send('Request not found');
    r.status = 'collected';
    await r.save();
    res.redirect('/admin/lab-test-requests');
  } catch (err) {
    console.error('Mark collected error:', err);
    res.status(500).send('Failed to mark collected');
  }
});

// 3) Upload final report -> mark reported + insert into LabTest for patient list
router.post('/lab-test-requests/:id/report', /*protect, isAdmin,*/ uploadLabReport.single('file'), async (req, res) => {
  try {
    const r = await LabTestRequest.findById(req.params.id);
    if (!r) return res.status(404).send('Request not found');

    if (!req.file) return res.status(400).send('Report file is required');

    r.status = 'reported';
    r.reportFilename = req.file.filename;
    r.reportUploadedAt = new Date();
    await r.save();

    // Also insert into LabTest (so it appears on patient's Lab Tests page with Download)
    await LabTest.create({
      patientId: r.patientId,
      testName: r.testName,
      performedBy: r.assignedEmployee?.name || 'Clinic',
      recordDate: new Date(),
      notes: r.notes || '',
      filename: req.file.filename,
    });

    // (Optional) also add a HealthRecord row if you want it in the Health Records table too

    res.redirect('/admin/lab-test-requests');
  } catch (err) {
    console.error('Upload report error:', err);
    res.status(500).send('Failed to upload report');
  }
});

module.exports = router;
