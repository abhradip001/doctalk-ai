// -------------------- AUTHENTICATION PLACEHOLDER -------------------- //
module.exports.authenticate = (req, res, next) => {
  console.log("Authentication check placeholder");
  next();
};

// -------------------- BASIC PROTECT (SESSION CHECK) -------------------- //
exports.protect = (req, res, next) => {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl; // so after login user returns back
    return res.redirect('/auth/login');
  }

  // Attach session user to req.user for controllers
  req.user = req.session.user;
  next();
};

// -------------------- ROLE-SPECIFIC GUARD -------------------- //
exports.isDoctor = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== 'doctor') {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
};
// backend/middlewares/authMiddleware.js
exports.isAdmin = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
};
