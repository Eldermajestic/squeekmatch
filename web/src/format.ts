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
