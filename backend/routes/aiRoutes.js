const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');

// Protected routes (require authentication)
router.use(authMiddleware.authenticate);

// Symptom analysis endpoint
router.post('/analyze', aiController.analyzeSymptoms);

// Chat with AI endpoint
router.post('/chat', aiController.chatWithAI);

module.exports = router;