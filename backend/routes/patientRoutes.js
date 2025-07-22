router.post('/submit-payment', authMiddleware, patientController.submitManualPayment);
