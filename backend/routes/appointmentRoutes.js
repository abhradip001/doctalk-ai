const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointmentController");
const { isAdmin, isPatient, isDoctor } = require("../middlewares/authMiddleware");

// Patient books
router.post("/book", isPatient, appointmentController.bookAppointment);

// Admin updates
router.put("/:id/status", isAdmin, appointmentController.updateStatus);
router.put("/:id/link", isAdmin, appointmentController.updateMeetingLink);

// Doctor & Patient views
router.get("/doctor/my", isDoctor, appointmentController.getDoctorAppointments);
router.get("/patient/my", isPatient, appointmentController.getPatientAppointments);

module.exports = router;
