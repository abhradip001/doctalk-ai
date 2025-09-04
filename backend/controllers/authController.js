const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.registerPatient = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed, role: 'patient' });
        await user.save();
        res.redirect('/patient/dashboard');
    } catch (err) {
        res.render('auth/register-patient', { error: 'Registration failed' });
    }
};

exports.registerDoctor = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed, role: 'doctor' });
        await user.save();
        res.redirect('/doctor/dashboard');
    } catch (err) {
        res.render('auth/register-doctor', { error: 'Registration failed' });
    }
};

    exports.registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed, role: 'admin' });
        await user.save();
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.render('auth/register-admin', { error: 'Registration failed' });
    }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.render('auth/login', { error: 'Invalid Email' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.render('auth/login', { error: 'Invalid Password' });

  // --- Store logged in user in session ---
  req.session.user = user;  // store full user object

  // Redirect after login (keep your role logic or redirect back if session.returnTo exists)
  const redirectUrl = req.session.returnTo || getDashboardUrl(user.role);
  delete req.session.returnTo;
  res.redirect(redirectUrl);
};

// helper function (keep this in same file)
function getDashboardUrl(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'doctor') return '/doctor/dashboard';
  return '/patient/dashboard';
}

