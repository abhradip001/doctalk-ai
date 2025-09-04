const Doctor = require('../models/Doctor');

exports.listDoctors = async (req, res) => {
    try {
        const query = {};
        if (req.query.specialization) query.specialization = req.query.specialization;
        if (req.query.experience) query.experience = { $gte: Number(req.query.experience) };

        const doctors = await Doctor.find(query);
        res.render('patient/doctorList', { doctors });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading doctor list');
    }
};
