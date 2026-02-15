/**
 * Ensure WebCrypto API is available in React Native before modules that use `jose`.
 * This module must be imported as early as possible (client/index.js).
 */
import webCrypto from "isomorphic-webcrypto/src/react-native.js";
import * as ExpoCrypto from "expo-crypto";

type RandomValueArray = Parameters<typeof ExpoCrypto.getRandomValues>[0];
const globalScope = globalThis as typeof globalThis & { crypto?: Crypto };
type SubtleImportKey = Crypto["subtle"]["importKey"];
type ImportKeyAlgorithm = Parameters<SubtleImportKey>[2];
type PatchedImportKey = SubtleImportKey & { __axonPatched__?: true };

const originalEnsureSecure =
  typeof webCrypto.ensureSecure === "function"
    ? webCrypto.ensureSecure.bind(webCrypto)
    : null;

function patchSubtleImportKeyCompatibility(): void {
  if (!webCrypto.subtle || typeof webCrypto.subtle.importKey !== "function") {
    return;
  }

  const subtle = webCrypto.subtle;
  const currentImportKey = subtle.importKey as PatchedImportKey;
  if (currentImportKey.__axonPatched__) {
    return;
  }
  const originalImportKey = subtle.importKey.bind(subtle) as SubtleImportKey;

  const wrappedImportKey = ((...args: Parameters<SubtleImportKey>) => {
    const normalizedArgs = [...args] as Parameters<SubtleImportKey>;
    const algorithm = normalizedArgs[2] as ImportKeyAlgorithm;
    if (typeof algorithm === "string") {
      normalizedArgs[2] = { name: algorithm } as ImportKeyAlgorithm;
    }
    return originalImportKey(...normalizedArgs);
  }) as PatchedImportKey;

  wrappedImportKey.__axonPatched__ = true;
  subtle.importKey = wrappedImportKey as SubtleImportKey;
}

if (originalEnsureSecure) {
  // Prevent unhandled promise rejection from the polyfill internal bootstrap.
  originalEnsureSecure().catch(() => {
    // no-op
  });
}

function isRandomValueArray(
  typedArray: ArrayBufferView,
): typedArray is RandomValueArray {
  return (
    typedArray instanceof Int8Array ||
    typedArray instanceof Uint8Array ||
    typedArray instanceof Uint8ClampedArray ||
    typedArray instanceof Int16Array ||
    typedArray instanceof Uint16Array ||
    typedArray instanceof Int32Array ||
    typedArray instanceof Uint32Array ||
    (typeof BigInt64Array !== "undefined" &&
      typedArray instanceof BigInt64Array) ||
    (typeof BigUint64Array !== "undefined" &&
      typedArray instanceof BigUint64Array)
  );
}

const secureGetRandomValues: Crypto["getRandomValues"] = <
  T extends ArrayBufferView,
>(
  typedArray: T,
): T => {
  if (!isRandomValueArray(typedArray)) {
    throw new TypeError(
      "crypto.getRandomValues expects an integer-based TypedArray",
    );
  }
  ExpoCrypto.getRandomValues(typedArray);
  return typedArray;
};
(webCrypto as Crypto).getRandomValues = secureGetRandomValues;

let initPrngPromise: Promise<void> | null = null;

async function ensurePrngSeeded(): Promise<void> {
  if (typeof webCrypto.initPrng !== "function") return;
  if (!initPrngPromise) {
    initPrngPromise = (async () => {
      const seed = await ExpoCrypto.getRandomBytesAsync(48);
      const entropy = Array.from(seed);
      if (entropy.length === 0) {
        throw new Error("Failed to initialize PRNG: empty entropy seed");
      }
      webCrypto.initPrng?.(entropy);
    })();
  }
  await initPrngPromise;
}

patchSubtleImportKeyCompatibility();

webCrypto.ensureSecure = async () => {
  await ensurePrngSeeded();
  if (originalEnsureSecure) {
    await originalEnsureSecure();
  }
  patchSubtleImportKeyCompatibility();
};

globalScope.crypto = webCrypto as Crypto;

let ensureSecurePromise: Promise<unknown> | null = null;

export async function ensureWebCryptoReady(): Promise<void> {
  if (typeof webCrypto.ensureSecure !== "function") return;
  if (!ensureSecurePromise) {
    ensureSecurePromise = webCrypto.ensureSecure();
  }
  await ensureSecurePromise;
  patchSubtleImportKeyCompatibility();
}

export {};
