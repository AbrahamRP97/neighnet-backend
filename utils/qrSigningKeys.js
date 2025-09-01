const { importJWK } = require('jose');

const ALG = 'EdDSA';

const getPrivateKey = async () => {
  const jwk = JSON.parse(process.env.SIGN_PRIVATE_JWK);
  return importJWK(jwk, ALG);
};

const getPublicJwk = () => JSON.parse(process.env.SIGN_PUBLIC_JWK);

module.exports = { ALG, getPrivateKey, getPublicJwk };
