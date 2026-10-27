import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Minimal .env.local reader for Playwright, which does not load Next.js env
 * files on its own. Never logs values.
 */
export function loadLocalEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  try {
    const contents = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  } catch {
    // CI may provide the variables directly in the process environment.
  }

  return env;
}

export function requireEnv(name: string, local: Record<string, string>): string {
  const value = process.env[name] ?? local[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
