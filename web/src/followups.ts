import type { Abi } from "viem";
import { api, type Config } from "./api";
import { nftAbi } from "./chain";
import type { FollowUp, Step } from "./tx";

export async function pairAfterBuy(cfg: Config, me: string, bought: { tokenId: number; level: number }[]): Promise<FollowUp | null> {
  const wallet = await api.wallet(me).catch(() => null);
  const boughtIds = new Set(bought.map((b) => b.tokenId));
  const pool = (wallet?.squeeks ?? []).filter((s) => s.custody === "wallet" && !boughtIds.has(s.id) && s.level < cfg.maximumLevel);
  const used = new Set<number>();
  const steps: Step[] = [];
  const pending = [...bought].filter((b) => b.level < cfg.maximumLevel);
  for (const b of pending) {
    if (used.has(b.tokenId)) continue;
    const partner =
      pool.find((s) => s.level === b.level && !used.has(s.id) && s.mergeReady) ??
      pending.find((x) => x.tokenId !== b.tokenId && x.level === b.level && !used.has(x.tokenId));
    if (!partner) continue;
    const keep = "id" in partner ? partner.id : partner.tokenId;
    used.add(keep);
    used.add(b.tokenId);
    steps.push({ label: `Merge #${b.tokenId} into #${keep} → L${b.level + 1}`, address: cfg.contracts.nft, abi: nftAbi as Abi, functionName: "merge", args: [BigInt(keep), BigInt(b.tokenId)] });
  }
  if (!steps.length) return null;
  return {
    title: `Pair ${steps.length > 1 ? "them" : "it"} now`,
    label: steps.length > 1 ? `Merge ${steps.length} pairs` : "Merge now",
    note: "Your older Squeek survives and keeps its id; the new one is burned. If either is still cooling down, the dry-run will tell you.",
    steps,
  };
}
