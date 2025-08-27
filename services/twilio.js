const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID,
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
  console.warn('[Twilio] Faltan variables de entorno para Verify');
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function sendVerifyCode(phoneE164) {
  return client.verify.v2
    .services(TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to: phoneE164, channel: 'sms' });
}

async function checkVerifyCode(phoneE164, code) {
  return client.verify.v2
    .services(TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phoneE164, code });
}

module.exports = { sendVerifyCode, checkVerifyCode };
