import 'dotenv/config';
import { importJWK } from 'jose';

const b64uLen = (s) => {
  if (typeof s !== 'string') return 0;
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64').length;
};

const priv = JSON.parse(process.env.SIGN_PRIVATE_JWK || '{}');
const pub  = JSON.parse(process.env.SIGN_PUBLIC_JWK  || '{}');

console.log('x bytes:', b64uLen(pub.x || '??'));
console.log('d bytes:', b64uLen(priv.d || '??'));

await importJWK(priv, 'EdDSA');
await importJWK(pub, 'EdDSA');

console.log('OK: importJWK(priv/pub) funciona');
