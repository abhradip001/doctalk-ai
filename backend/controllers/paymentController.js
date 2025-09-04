const Payment = require('../models/Payment');

    exports.submitManualPayment = async (req, res) => {
    const { doctorId, transactionId, amount } = req.body;

    const payment = new Payment({
        patientId: req.user._id,
        doctorId,
        totalAmount: amount,
        transactionId,
        status: 'pending',
        paymentMethod: 'qr_manual',
        platformFee: 100,
        doctorShare: amount - 100,
        doctorPaid: false
    });

    await payment.save();
    res.send("✅ Payment submitted. Admin will verify and confirm your appointment.");
};
