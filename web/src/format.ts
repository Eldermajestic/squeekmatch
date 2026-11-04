import { formatUnits, parseUnits } from "viem";

export const sqk = (v: string | bigint | null | undefined, digits = 2) =>
  v === null || v === undefined
    ? "—"
    : `${Number(formatUnits(BigInt(v), 18)).toLocaleString("en-US", { maximumFractionDigits: digits })} SQK`;

export const toUnits = (v: string) => {
  try {
    const n = parseUnits(v.trim() || "0", 18);
    return n > 0n ? n : null;
  } catch {
    return null;
  }
};

export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
export const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const until = (unix: number) => {
  const s = unix - Math.floor(Date.now() / 1000);
  if (s <= 0) return "expired";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

export const blocksLeft = (next: number, height: number) => Math.max(0, next - height);

export function eta(blocks: number, perDay: number | null | undefined) {
  if (blocks <= 0) return "ready";
  if (!perDay) return `${blocks.toLocaleString("en-US")} Squeek blocks`;
  const days = blocks / perDay;
  if (days < 1) return `~${Math.max(1, Math.round(days * 24))}h of hamster running`;
  const n = Math.round(days);
  return `~${n} hamster night${n > 1 ? "s" : ""}`;
}

export const perDay = (power: number, rate: number | null | undefined) =>
  rate ? `${(power * rate).toLocaleString("en-US", { maximumFractionDigits: power * rate < 10 ? 2 : 0 })} SQK/day` : null;

export const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      return;
    }
  },
};
