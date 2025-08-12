const COMMON_PASSWORDS = new Set([
  '123456', '123456789', 'qwerty', 'password', '111111', '12345678', 'abc123',
  '1234567', '12345', 'iloveyou', '000000', '123123', 'admin', 'letmein', 'welcome'
]);

function stripAccents(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isStrongPassword(pw = '') {
  // >= 8 chars, 1 uppercase, 1 number, 1 special char
  const re = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return re.test(pw);
}

function passwordPolicyErrors(pw, { nombre, correo, telefono } = {}) {
  const errors = [];

  if (!isStrongPassword(pw)) {
    errors.push('Debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo.');
  }

  const pwLower = stripAccents(pw);
  if (COMMON_PASSWORDS.has(pwLower)) {
    errors.push('La contraseña es demasiado común.');
  }

  // Evitar datos personales dentro de la contraseña
  const pieces = [];
  if (nombre) pieces.push(stripAccents(nombre));
  if (correo) pieces.push(stripAccents(String(correo)).split('@')[0]);
  if (telefono) pieces.push(String(telefono).replace(/\D/g, ''));

  for (const piece of pieces) {
    if (piece && piece.length >= 3 && pwLower.includes(piece)) {
      errors.push('La contraseña no debe contener tus datos personales.');
      break;
    }
  }

  return errors;
}

module.exports = { isStrongPassword, passwordPolicyErrors };
