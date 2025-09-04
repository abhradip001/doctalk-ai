const express = require('express');
const router = express.Router();

// Patient dashboard
router.get('/patient/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'patient') {
        return res.redirect('/auth/login');
    }
    res.render('patient/dashboard', { 
        title: 'Patient Dashboard',
        patientName: req.session.user.name
    });
});

// Doctor dashboard
router.get('/doctor/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'doctor') {
        return res.redirect('/auth/login');
    }
    res.render('doctor/dashboard', { 
        title: 'Doctor Dashboard',
        doctorName: req.session.user.name
    });
});

// Admin dashboard
router.get('/admin/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/auth/login');
    }
    res.render('admin/dashboard', { 
        title: 'Admin Dashboard',
        adminName: req.session.user.name
    });
});

module.exports = router;
