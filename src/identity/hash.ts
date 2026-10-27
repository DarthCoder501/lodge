import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, (error, key) => {
      if (error) reject(error);
      else resolve(`scrypt$${salt}$${key.toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      const expected = Buffer.from(hash, "hex");
      resolve(expected.length === key.length && timingSafeEqual(key, expected));
    });
  });
}
