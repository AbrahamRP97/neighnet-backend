import 'dotenv/config';
import { importJWK } from 'jose';

const priv = JSON.parse(process.env.SIGN_PRIVATE_JWK || '{}');
const pub  = JSON.parse(process.env.SIGN_PUBLIC_JWK  || '{}');

const toLen = (b64u) => {
  const pad = (4 - (b64u.length % 4)) % 4;
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64').length;
};

console.log('x bytes:', toLen(pub.x || '??'));
console.log('d bytes:', toLen(priv.d || '??'));

await importJWK(priv, 'EdDSA'); // debe pasar sin lanzar excepción
await importJWK(pub, 'EdDSA');

console.log('OK: importJWK(priv/pub) funciona');
