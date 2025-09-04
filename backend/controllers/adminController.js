const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { createGoogleMeet } = require('../utils/meetScheduler'); // make sure this exports a function

exports.markDoctorPaid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send('Payment not found');
    }

    // (Optional) sanity: ensure it isn’t already paid
    if (payment.doctorPaid === true) {
      await session.commitTransaction();
      session.endSession();
      return res.redirect('/admin/earnings');
    }

    // Pick appointment time:
    // - from req.body.dateTime (admin-selected), else default = +1 hour
    const dateTimeRaw = req.body?.dateTime;
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    const when = dateTimeRaw ? new Date(dateTimeRaw) : defaultTime;
    const isValidDate = when && !isNaN(when.getTime());
    const startTime = isValidDate ? when : defaultTime;

    // If your meet util accepts metadata, pass it; otherwise call without args
    let meetLink = null;
    try {
      // Example extended signature; adjust to your util:
      // const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      // meetLink = await createGoogleMeet({
      //   summary: 'Doctor Consultation',
      //   start: startTime,
      //   end: endTime,
      //   attendees: [] // you can add patient/doctor emails if available
      // });

      meetLink = await createGoogleMeet(); // fallback if your function has no params
    } catch (e) {
      console.warn('createGoogleMeet failed, continuing without link:', e.message);
      meetLink = null; // still create the appointment
    }

    // Create appointment (NOTE: use `date`, not `time`)
    const appt = await Appointment.create([{
      patientId: payment.patientId,
      doctorId: payment.doctorId,
      date: startTime,               // ✅ matches your EJS template
      status: 'Approved',            // show as Approved in admin UI
      meetingLink: meetLink
    }], { session });

    // Mark doctor as paid
    payment.status = 'paid';         // ensure this matches your Payment status enum
    payment.doctorPaid = true;
    payment.doctorPayoutDate = new Date();
    await payment.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.redirect('/admin/earnings');
  } catch (err) {
    console.error('Error in markDoctorPaid:', err);
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    return res.status(500).send('Server Error');
  }
};
