import { generateKeyPair, exportJWK } from 'jose';

const isoDate = new Date().toISOString().slice(0, 10);
const kid = `key-${isoDate}`;

const { publicKey, privateKey } = await generateKeyPair('Ed25519', {
  extractable: true, // <- CLAVE
});

// A JWK
const pub = await exportJWK(publicKey);
pub.kty = 'OKP';
pub.crv = 'Ed25519';
pub.kid = kid;

const priv = await exportJWK(privateKey);
priv.kty = 'OKP';
priv.crv = 'Ed25519';
priv.kid = kid;

console.log('SIGN_PRIVATE_JWK=' + JSON.stringify(priv));
console.log('SIGN_PUBLIC_JWK='  + JSON.stringify(pub));
