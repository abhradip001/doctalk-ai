const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const { createGoogleMeet } = require('../utils/meetScheduler'); // ✅ Import Meet generator

exports.markDoctorPaid = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);

        if (!payment) {
        return res.status(404).send("Payment not found");
        }

        // Mark as paid
        payment.status = "paid";
        payment.doctorPaid = true;
        payment.doctorPayoutDate = new Date();
        await payment.save();

        // ✅ Create Appointment with Google Meet
        const meetLink = await createGoogleMeet(); // if your function doesn't need parameters

        const appointment = new Appointment({
        patientId: payment.patientId,
        doctorId: payment.doctorId,
        time: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        meetingLink: meetLink
        });

        await appointment.save();

        res.redirect('/admin/earnings');
    } catch (err) {
        console.error("Error in markDoctorPaid:", err);
        res.status(500).send("Server Error");
    }
};
