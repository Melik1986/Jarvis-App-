declare module "isomorphic-webcrypto/src/react-native.js" {
  type IsomorphicWebCrypto = Crypto & {
    ensureSecure?: () => Promise<unknown>;
    initPrng?: (seed: number[]) => void;
  };

  const webCrypto: IsomorphicWebCrypto;
  export default webCrypto;
}
