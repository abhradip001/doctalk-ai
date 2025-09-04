const express = require('express');
const bcrypt = require('bcrypt');
const Patient = require('../models/Patient');
const Doctor  = require('../models/Doctor');
const Admin   = require('../models/Admin');
// (optional fallback if your doctors were saved in User model earlier)
// const User    = require('../models/User');

const router = express.Router();

function escapeRegExp(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function ciEmailQuery(email = '') {
  // case-insensitive EXACT match
  const rx = new RegExp(`^${escapeRegExp(String(email).trim())}$`, 'i');
  return { email: rx };
}

// -------------------- LOGIN PAGE -------------------- //
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// -------------------- LOGIN HANDLER -------------------- //
router.post('/login', async (req, res) => {
  try {
    let { email, password, role } = req.body;
    email = (email || '').trim();
    role = (role || '').toLowerCase();

    if (!email || !password) {
      return res.status(400).render('auth/login', { error: 'Email and password are required' });
    }

    const query = ciEmailQuery(email);
    let user = null;
    let resolvedRole = role;

    // Try declared role first
    if (role === 'patient') user = await Patient.findOne(query);
    else if (role === 'doctor') user = await Doctor.findOne(query);
    else if (role === 'admin') user = await Admin.findOne(query);

    // Fallbacks: doctor → patient → admin
    if (!user) { user = await Doctor.findOne(query); if (user) resolvedRole = 'doctor'; }
    if (!user) { user = await Patient.findOne(query); if (user) resolvedRole = 'patient'; }
    if (!user) { user = await Admin.findOne(query);   if (user) resolvedRole = 'admin'; }

    // (Optional legacy fallback if some doctors live in User model)
    // if (!user) {
    //   const maybeUser = await User.findOne(query);
    //   if (maybeUser && maybeUser.role === 'doctor') {
    //     user = maybeUser;
    //     resolvedRole = 'doctor';
    //   }
    // }

    if (!user) {
      return res.status(400).render('auth/login', { error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).render('auth/login', { error: 'Invalid email or password' });
    }

    // Save to session (include email for doctor pages)
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: resolvedRole
    };

    if (resolvedRole === 'patient') return res.redirect('/patient/dashboard');
    if (resolvedRole === 'doctor')  return res.redirect('/doctor/dashboard');
    if (resolvedRole === 'admin')   return res.redirect('/admin/dashboard');

    return res.redirect('/auth/login');
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).render('auth/login', { error: 'Server error: ' + error.message });
  }
});

// -------------------- LOGOUT -------------------- //
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
