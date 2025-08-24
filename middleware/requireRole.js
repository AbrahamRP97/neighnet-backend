module.exports = function requireRole(...rolesPermitidos) {
  return function (req, res, next) {
    try {
      const rol = req.user?.rol;
      if (!rol) {
        return res.status(403).json({ error: 'No autorizado (sin rol)' });
      }
      if (!rolesPermitidos.includes(rol)) {
        return res.status(403).json({ error: 'No autorizado (rol insuficiente)' });
      }
      next();
    } catch (err) {
      console.error('[requireRole] error:', err?.message || err);
      return res.status(500).json({ error: 'Error interno de autorización' });
    }
  };
};
