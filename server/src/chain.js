import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { config } from "./config.js";

export const client = createPublicClient({
  chain: sepolia,
  transport: http(config.rpcUrl, { timeout: 20_000, retryCount: 3, retryDelay: 800 }),
  batch: { multicall: { batchSize: 2048, wait: 10 } },
});

export const nftAbi = parseAbi([
  "function ownerOf(uint256) view returns (address)",
  "function level(uint256) view returns (uint8)",
  "function nextMergeHeight(uint256) view returns (uint256)",
  "function sqkCore() view returns (address)",
  "function totalIssued() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);

export const coreAbi = parseAbi([
  "function state() view returns ((uint64 settledThroughRound, uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint64 blockHeight, uint96 blockProgress, uint32 workPerThousandBlocks, uint256 authorizationNonce, bool paused))",
]);

export const escrowViewAbi = parseAbi([
  "function SQUEEK() view returns (address)",
  "function SQK() view returns (address)",
  "function MAXIMUM_LEVEL() view returns (uint8)",
  "function isFillable(uint256) view returns (bool)",
]);

export async function multicallChunks(contracts, size = 600) {
  const out = [];
  for (let i = 0; i < contracts.length; i += size) {
    const res = await client.multicall({ contracts: contracts.slice(i, i + size), allowFailure: true });
    out.push(...res);
  }
  return out;
}

export async function coreHeight(core) {
  const s = await client.readContract({ address: core, abi: coreAbi, functionName: "state" });
  return s.blockHeight;
}

export async function fetchApi(path, timeout = 15_000) {
  const r = await fetch(`${config.api}${path}`, { signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`Squeekchain API ${path}: HTTP ${r.status}`);
  return r.json();
}
