import { readFileSync } from "node:fs";
import { register } from "node:module";

try {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const splitAt = trimmed.indexOf("=");
    if (splitAt === -1) continue;
    const key = trimmed.slice(0, splitAt);
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(splitAt + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
} catch {
  // DATABASE_URL may already be set in the environment.
}

register("./resolve-ts.mjs", import.meta.url);
