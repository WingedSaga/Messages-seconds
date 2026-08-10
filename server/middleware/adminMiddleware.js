function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Доступен только администраторам' });
  }
  return next();
}

module.exports = { adminMiddleware };
