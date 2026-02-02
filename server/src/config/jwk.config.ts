import { generateKeyPairSync } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { AppLogger } from "../utils/logger";

let SERVER_PUBLIC_KEY: string;
let SERVER_PRIVATE_KEY: string;

// Try to load keys from file, or generate new ones
const keysPath = path.join(process.cwd(), ".keys");
const publicKeyPath = path.join(keysPath, "public.pem");
const privateKeyPath = path.join(keysPath, "private.pem");

try {
  if (fs.existsSync(publicKeyPath) && fs.existsSync(privateKeyPath)) {
    SERVER_PUBLIC_KEY = fs.readFileSync(publicKeyPath, "utf-8");
    SERVER_PRIVATE_KEY = fs.readFileSync(privateKeyPath, "utf-8");
    AppLogger.info("Loaded JWE keys from .keys directory");
  } else {
    // Generate new key pair
    const { publicKey, privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    SERVER_PUBLIC_KEY = publicKey;
    SERVER_PRIVATE_KEY = privateKey;

    // Save keys to file (create directory if needed)
    if (!fs.existsSync(keysPath)) {
      fs.mkdirSync(keysPath, { recursive: true });
    }
    fs.writeFileSync(publicKeyPath, publicKey, "utf-8");
    fs.writeFileSync(privateKeyPath, privateKey, "utf-8");
    AppLogger.info("Generated new JWE keys and saved to .keys directory");
  }
} catch (error) {
  AppLogger.error("Failed to load or generate JWE keys:", error);
  // Fallback: generate in-memory keys (not persisted)
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  SERVER_PUBLIC_KEY = publicKey;
  SERVER_PRIVATE_KEY = privateKey;
  AppLogger.warn("Using in-memory JWE keys (not persisted)");
}

export { SERVER_PUBLIC_KEY, SERVER_PRIVATE_KEY };
