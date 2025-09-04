// backend/routes/aiRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const aiController = require('../controllers/aiController');

const Doctor = require('../models/Doctor');
const ChatMessage = require('../models/ChatMessage');
const specialtiesFor = require('../utils/specialtyMap');
const { processInput } = require('../../ai-modules/symptom-analysis/nlpProcessor');

// Make sure user session is loaded
router.use(authMiddleware.authenticate);

/* ============================================================================ 
   Helpers
============================================================================ */
async function saveChat({ userId, userRole = 'patient', from, message, lang = 'en', intent = 'symptom-checker' }) {
  if (!message || !String(message).trim()) return;
  await ChatMessage.create({
    userId: userId || null,
    userRole,
    from, // 'patient' | 'ai'
    message: String(message).trim(),
    lang,
    intent,
  });
}

/* ============================================================================ 
   POST /chat 
   - Saves patient message
   - Runs AI controller
   - Saves AI reply
============================================================================ */
router.post('/chat', async (req, res) => {
  try {
    const message = (req.body?.message || '').trim();
    const lang = (req.body?.lang || 'en').trim();

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userId = req.session?.user?.id || null;
    const userRole = req.session?.user?.role || 'patient';

    // Save patient message
    await saveChat({ userId, userRole, from: 'patient', message, lang });

    // 🔹 Call the real AI controller (directly, not the fallback)
    const fakeReq = { body: { message, lang }, session: req.session };
    const fakeRes = {
      json: (data) => data,
    };
    const aiResult = await aiController.chatWithAI(fakeReq, fakeRes);

    // AI controller returns via res.json, but since we intercepted,
    // we just get the object directly.
    const reply = aiResult?.reply || '[]';

    // Save AI reply in chat log
    await saveChat({ userId, userRole, from: 'ai', message: reply, lang });

    return res.json(aiResult);
  } catch (err) {
    console.error('AI /chat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ============================================================================ 
   Specialty helpers for better matching
============================================================================ */
const SPECIALTY_SYNONYMS = {
  cardiology: ['cardiology', 'cardiologist', 'heart'],
  dermatology: ['dermatology', 'dermatologist', 'skin'],
  neurology: ['neurology', 'neurologist', 'brain'],
  pediatrics: ['pediatrics', 'pediatrician', 'child', 'children'],
  general: ['general', 'general physician', 'internal medicine', 'family medicine'],
};

function buildSpecialtyRegexes(labels) {
  const toks = new Set();

  (labels || []).forEach((l) => {
    if (!l) return;
    const t = String(l).toLowerCase().trim();

    toks.add(t);
    toks.add(t.replace(/ist\b/, 'y'));
    toks.add(t.replace(/ology\b/, 'ologist'));

    Object.values(SPECIALTY_SYNONYMS).forEach((syns) => {
      if (syns.includes(t)) syns.forEach((x) => toks.add(x));
    });
  });

  return Array.from(toks)
    .filter(Boolean)
    .map((s) => ({
      specialization: {
        $regex: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      },
    }));
}

/* ============================================================================ 
   POST /triage 
============================================================================ */
router.post('/triage', async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Symptom text is required' });
    }

    const userId = req.session?.user?.id || null;
    const userRole = req.session?.user?.role || 'patient';
    await saveChat({ userId, userRole, from: 'patient', message: text, lang: 'en', intent: 'symptom-checker' });

    // NLP
    const result = await processInput(text);

    // Map to specialties
    let specialties = specialtiesFor({
      condition: result.condition,
      symptoms: result.symptoms,
    }) || [];

    specialties = specialties.map((s) => (s ? String(s).trim() : '')).filter(Boolean);

    let doctors = [];
    if (specialties.length) {
      doctors = await Doctor.find({ specialization: { $in: specialties } })
        .select('name specialization experience fee profileImage')
        .sort({ experience: -1 });
    }

    if (!doctors.length) {
      const labels = [
        ...specialties,
        result.condition || '',
        ...(Array.isArray(result.symptoms) ? result.symptoms : []),
      ].filter(Boolean);

      const orRegex = buildSpecialtyRegexes(labels);
      if (orRegex.length) {
        doctors = await Doctor.find({ $or: orRegex })
          .select('name specialization experience fee profileImage')
          .sort({ experience: -1 });
      }
    }

    if (!doctors.length) {
      doctors = await Doctor.find({ specialization: /general/i })
        .select('name specialization experience fee profileImage')
        .sort({ experience: -1 });

      if (!specialties.includes('General')) specialties.push('General');
    }

    return res.json({
      ...result,
      specialties,
      doctors,
    });
  } catch (err) {
    console.error('AI /triage error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
