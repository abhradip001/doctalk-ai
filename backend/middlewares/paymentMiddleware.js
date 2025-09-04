const Patient = require('../models/Patient');

exports.ensurePayment = async (req, res, next) => {
  try {
    // Ensure user is logged in
    if (!req.session.user) {
      req.session.returnTo = req.originalUrl; // so after login user returns back
      return res.redirect('/auth/login');
    }

    // Get latest patient data from DB
    const freshUser = await Patient.findById(req.session.user.id);
    if (!freshUser) {
      return res.redirect('/auth/login');
    }

    // Check subscription/payment status
    if (!freshUser.hasPaid) {
      return res.status(403).render('patient/payment', {
        message: 'You need to complete payment before accessing this feature.'
      });
    }

    // Attach updated user object
    req.user = freshUser;
    next();
  } catch (err) {
    console.error("EnsurePayment Error:", err);
    res.redirect('/auth/login');
  }
};
