const { passwordPolicyErrors } = require('../utils/password');

function passwordPolicy({ field }) {
  return (req, res, next) => {
    try {
      const pw = req.body?.[field];
      if (typeof pw !== 'string') {
        return res.status(400).json({ error: `El campo '${field}' es requerido` });
      }

      const contexto = {
        nombre: req.body?.nombre,
        correo: req.body?.correo,
        telefono: req.body?.telefono,
      };

      const errors = passwordPolicyErrors(pw, contexto);
      if (errors.length) {
        return res.status(400).json({ error: errors.join(' ') });
      }

      next();
    } catch {
      return res.status(400).json({ error: 'Validación de contraseña inválida' });
    }
  };
}

module.exports = passwordPolicy;
