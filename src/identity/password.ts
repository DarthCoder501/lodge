/// <reference types="node" />
// Keeps node:crypto and Buffer visible when tsconfig "types" does not include node.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const keyLength = 32;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, (error: Error | null, key: Buffer) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return deriveKey(password, salt).then((key) => `scrypt$${salt}$${key.toString("hex")}`);
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return Promise.resolve(false);
  return deriveKey(password, salt).then(
    (key) => {
      try {
        const expected = Buffer.from(hash, "hex");
        return expected.length === key.length && timingSafeEqual(key, expected);
      } catch {
        return false;
      }
    },
    () => false,
  );
}
