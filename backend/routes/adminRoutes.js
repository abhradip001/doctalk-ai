router.get('/earnings', authMiddleware, adminController.viewEarnings);
router.post('/pay-doctor/:paymentId', authMiddleware, adminController.markDoctorPaid);
