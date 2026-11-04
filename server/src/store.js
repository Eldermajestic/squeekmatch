import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";

const replacer = (_, v) => (typeof v === "bigint" ? { $b: v.toString() } : v);
const reviver = (_, v) => (v && typeof v === "object" && "$b" in v ? BigInt(v.$b) : v);

export function createStore(dir) {
  mkdirSync(dir, { recursive: true });
  return {
    load(name, fallback) {
      const p = join(dir, `${name}.json`);
      if (!existsSync(p)) return fallback;
      try {
        return JSON.parse(readFileSync(p, "utf8"), reviver);
      } catch {
        return fallback;
      }
    },
    save(name, value) {
      const p = join(dir, `${name}.json`);
      writeFileSync(`${p}.tmp`, JSON.stringify(value, replacer));
      renameSync(`${p}.tmp`, p);
    },
  };
}

export const toJson = (value) => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
