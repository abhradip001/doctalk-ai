const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");

// ------------------ PATIENT ------------------
// Patient books appointment
exports.bookAppointment = async (req, res) => {
  try {
    const patientId = req.user._id; // from JWT/session
    const { doctorId, date } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ message: "Doctor and date are required" });
    }

    // check doctor exists
    const doctorExists = await Doctor.findById(doctorId).select("_id");
    if (!doctorExists) return res.status(404).json({ message: "Doctor not found" });

    const when = new Date(date);
    if (isNaN(when.getTime())) return res.status(400).json({ message: "Invalid date" });

    const appointment = await Appointment.create({
      doctorId,
      patientId,
      date: when,
      status: "Pending",
      meetingLink: null
    });

    res.status(201).json({ message: "Appointment booked successfully", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error booking appointment", error: err.message });
  }
};

// ------------------ ADMIN ------------------
// Approve / Cancel appointment
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    res.json({ message: "Appointment status updated", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error updating status", error: err.message });
  }
};

// ------------------ ADMIN ------------------
// Add/Update meeting link
exports.updateMeetingLink = async (req, res) => {
  try {
    const { meetingLink } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    appointment.meetingLink = meetingLink || null;
    await appointment.save();

    res.json({ message: "Meeting link saved successfully", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error updating meeting link", error: err.message });
  }
};

// ------------------ DOCTOR ------------------
// Doctor views his appointments
exports.getDoctorAppointments = async (req, res) => {
  try {
    const doctorDoc = await Doctor.findOne({ user: req.user._id }).select("_id");
    if (!doctorDoc) return res.status(404).json({ message: "Doctor profile not found" });

    const appointments = await Appointment.find({ doctorId: doctorDoc._id })
      .populate("patientId", "name email")
      .sort({ date: 1 });

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching doctor appointments", error: err.message });
  }
};

// ------------------ PATIENT ------------------
// Patient views his appointments
exports.getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user._id })
      .populate("doctorId", "name specialization")
      .sort({ date: 1 });

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching patient appointments", error: err.message });
  }
};
