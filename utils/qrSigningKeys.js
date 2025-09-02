const { importJWK } = require('jose');

const ALG = 'EdDSA';

const b64uLen = (s) => {
  if (typeof s !== 'string') return 0;
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64').length;
};

let _privKeyPromise = null;

const getPrivateKey = async () => {
  if (!_privKeyPromise) {
    _privKeyPromise = (async () => {
      const raw = process.env.SIGN_PRIVATE_JWK;
      if (!raw) throw new Error('SIGN_PRIVATE_JWK no definido');
      let jwk;
      try { jwk = JSON.parse(raw); } catch { throw new Error('SIGN_PRIVATE_JWK no es JSON'); }

      if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.d || !jwk.x) {
        throw new Error('SIGN_PRIVATE_JWK debe tener {kty:"OKP", crv:"Ed25519", d, x}');
      }
      if (b64uLen(jwk.x) !== 32 || b64uLen(jwk.d) !== 32) {
        throw new Error('SIGN_PRIVATE_JWK: x/d deben decodificar a 32 bytes');
      }
      return importJWK(jwk, ALG);
    })();
  }
  return _privKeyPromise;
};

const getPublicJwk = () => {
  const raw = process.env.SIGN_PUBLIC_JWK;
  if (!raw) throw new Error('SIGN_PUBLIC_JWK no definido');
  let jwk;
  try { jwk = JSON.parse(raw); } catch { throw new Error('SIGN_PUBLIC_JWK no es JSON'); }
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.x) {
    throw new Error('SIGN_PUBLIC_JWK debe tener {kty:"OKP", crv:"Ed25519", x}');
  }
  if (b64uLen(jwk.x) !== 32) {
    throw new Error('SIGN_PUBLIC_JWK: x debe decodificar a 32 bytes');
  }
  return jwk;
};

module.exports = { ALG, getPrivateKey, getPublicJwk };
