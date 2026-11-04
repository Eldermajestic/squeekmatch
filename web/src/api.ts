import type { Address } from "viem";

export type Contracts = { nft: Address; sqk: Address; core: Address; staking: Address; escrow: Address | null };
export type Config = {
  status: "verified" | "mismatch" | "loading";
  chainId: number;
  release: string;
  contracts: Contracts;
  maximumLevel: number;
  cooldownBlocks: number[];
  basePower: number[];
  mergesOpen: boolean;
  checks: { label: string; expected: string; actual: string; ok: boolean }[];
  coreHeight: number | null;
  snapshotAt: number | null;
  telegramBot: string | null;
};
export type Squeek = {
  id: number;
  owner: string;
  level: number;
  nextMergeHeight: number;
  custody: "wallet" | "staking";
  mergeReady: boolean;
};
export type Order = {
  id: number;
  kind: "Ask" | "Bid" | "Swap";
  maker: string;
  taker?: string;
  tokenId?: number;
  level: number;
  wantedTokenId?: number;
  wantedLevel?: number;
  mergeReady?: boolean;
  price?: string;
  amount?: string;
  sqkFromMaker?: string;
  sqkFromTaker?: string;
  expiresAt: number;
  status: "open" | "filled" | "cancelled" | "expired";
  fillable: boolean;
};
export type Wallet = {
  address: string;
  coreHeight: number;
  squeeks: Squeek[];
  rewards: { claimableBaseUnits?: string } | null;
  power: { nftPower?: string } | null;
  apiStatus: string;
  orders: Order[];
};
export type BoardSingle = { owner: string; level: number; tokenId: number; mergeReady: boolean; nextMergeHeight: number };
export type Board = {
  at: number;
  coreHeight: number;
  holders: number;
  levels: Record<string, { holders: number; squeeks: number; singles: number }>;
  singles: BoardSingle[];
};
export type Fill = { id: number; kind: string; maker: string; taker: string; tokenId: number; level?: number; amount: string; tx: string };
export type Market = {
  levels: { level: number; floorAsk: string | null; bestBid: string | null; asks: number; bids: number }[];
  lastFills: Fill[];
  mostWantedLevel: number | null;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`/api${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`SqueekMatch server: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export const api = {
  config: () => get<Config>("/config"),
  wallet: (a: string) => get<Wallet>(`/wallet/${a}`),
  board: () => get<Board>("/board"),
  orders: (status = "open") => get<{ orders: Order[] }>(`/orders?status=${status}`).then((r) => r.orders),
  market: () => get<Market>("/market"),
};
