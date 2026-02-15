import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
} from "crypto";
import * as fs from "fs";
import * as path from "path";
import { AppLogger } from "../utils/logger";

export const JWE_KEY_ALGORITHM = "RSA-OAEP-256" as const;
export const JWE_KEY_ALGORITHMS = ["RSA-OAEP-256", "RSA-OAEP"] as const;
const JWE_RSA_MODULUS_LENGTH = 2048;

let SERVER_PUBLIC_KEY: string;
let SERVER_PRIVATE_KEY: string;
let SERVER_PUBLIC_JWK: JwePublicJwk;
let JWE_KEY_ID: string;

// Try to load keys from file, or generate new ones
const keysPath = path.join(process.cwd(), ".keys");
const publicKeyPath = path.join(keysPath, "public.pem");
const privateKeyPath = path.join(keysPath, "private.pem");

interface JwePublicJwk {
  kty: "RSA";
  n: string;
  e: string;
  alg: (typeof JWE_KEY_ALGORITHMS)[number];
  use: "enc";
  kid: string;
  ext: true;
  key_ops: ["encrypt", "wrapKey"];
}

function isRsaKeyPair(publicKeyPem: string, privateKeyPem: string): boolean {
  try {
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(publicKeyPem);
    return isRsaKeyObject(privateKey) && isRsaKeyObject(publicKey);
  } catch {
    return false;
  }
}

function isRsaKeyObject(key: KeyObject): boolean {
  return key.asymmetricKeyType === "rsa";
}

function generateRsaKeyPair(): { publicKey: string; privateKey: string } {
  return generateKeyPairSync("rsa", {
    modulusLength: JWE_RSA_MODULUS_LENGTH,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function setPublicKeyArtifacts(publicKeyPem: string): void {
  const exported = createPublicKey(publicKeyPem).export({ format: "jwk" });
  if (
    typeof exported !== "object" ||
    exported === null ||
    !("kty" in exported) ||
    !("n" in exported) ||
    !("e" in exported) ||
    exported.kty !== "RSA" ||
    typeof exported.n !== "string" ||
    typeof exported.e !== "string"
  ) {
    throw new Error("Failed to export RSA public key as JWK");
  }

  const kid = createHash("sha256")
    .update(`${exported.n}.${exported.e}`)
    .digest("base64url")
    .slice(0, 24);

  SERVER_PUBLIC_JWK = {
    kty: "RSA",
    n: exported.n,
    e: exported.e,
    alg: JWE_KEY_ALGORITHM,
    use: "enc",
    kid,
    ext: true,
    key_ops: ["encrypt", "wrapKey"],
  };
  JWE_KEY_ID = kid;
}

function writeKeyPair(publicKey: string, privateKey: string): void {
  if (!fs.existsSync(keysPath)) {
    fs.mkdirSync(keysPath, { recursive: true });
  }
  fs.writeFileSync(publicKeyPath, publicKey, "utf-8");
  fs.writeFileSync(privateKeyPath, privateKey, "utf-8");
}

try {
  if (fs.existsSync(publicKeyPath) && fs.existsSync(privateKeyPath)) {
    const publicKey = fs.readFileSync(publicKeyPath, "utf-8");
    const privateKey = fs.readFileSync(privateKeyPath, "utf-8");
    if (isRsaKeyPair(publicKey, privateKey)) {
      SERVER_PUBLIC_KEY = publicKey;
      SERVER_PRIVATE_KEY = privateKey;
      setPublicKeyArtifacts(publicKey);
      AppLogger.info("Loaded RSA JWE keys from .keys directory");
    } else {
      AppLogger.warn(
        "Existing JWE keys are not RSA. Regenerating RSA key pair for RSA-OAEP-256.",
      );
      const generated = generateRsaKeyPair();
      SERVER_PUBLIC_KEY = generated.publicKey;
      SERVER_PRIVATE_KEY = generated.privateKey;
      setPublicKeyArtifacts(generated.publicKey);
      writeKeyPair(generated.publicKey, generated.privateKey);
      AppLogger.info("Generated RSA JWE keys and replaced .keys contents");
    }
  } else {
    const generated = generateRsaKeyPair();
    SERVER_PUBLIC_KEY = generated.publicKey;
    SERVER_PRIVATE_KEY = generated.privateKey;
    setPublicKeyArtifacts(generated.publicKey);
    writeKeyPair(generated.publicKey, generated.privateKey);
    AppLogger.info("Generated new RSA JWE keys and saved to .keys directory");
  }
} catch (error) {
  AppLogger.error("Failed to load or generate JWE keys:", error);
  const generated = generateRsaKeyPair();
  SERVER_PUBLIC_KEY = generated.publicKey;
  SERVER_PRIVATE_KEY = generated.privateKey;
  setPublicKeyArtifacts(generated.publicKey);
  AppLogger.warn("Using in-memory RSA JWE keys (not persisted)");
}

export { SERVER_PUBLIC_KEY, SERVER_PRIVATE_KEY, SERVER_PUBLIC_JWK, JWE_KEY_ID };
