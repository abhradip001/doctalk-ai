// backend/middlewares/roleMiddleware.js
exports.role = (roles) => (req, res, next) => {
  if (roles.includes(req.user?.role)) return next();
  return res.status(403).send('Forbidden');
};
