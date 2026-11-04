import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(resolve(here, "../.env"));

const env = process.env;
const addr = (v) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : null);

export const config = {
  port: Number(env.PORT || 8787),
  rpcUrl: env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  api: (env.SQUEEKCHAIN_API || "https://api.squeekchain.com").replace(/\/$/, ""),
  escrow: addr(env.ESCROW),
  escrowFromBlock: env.ESCROW_FROM_BLOCK ? BigInt(env.ESCROW_FROM_BLOCK) : null,
  telegramToken: env.TELEGRAM_TOKEN || "",
  telegramBotName: env.TELEGRAM_BOT_NAME || "",
  siteUrl: (env.SITE_URL || "https://squeekmatch.xyz").replace(/\/$/, ""),
  dataDir: resolve(here, "..", env.DATA_DIR || "./data"),
  snapshotSeconds: Number(env.SNAPSHOT_SECONDS || 180),
  ordersSeconds: Number(env.ORDERS_SECONDS || 30),
  override: { nft: addr(env.SQUEEK_NFT), sqk: addr(env.SQK_TOKEN) },
  chainId: 11155111,
};

export const escrowAbi = JSON.parse(readFileSync(resolve(here, "../../shared/escrow-abi.json"), "utf8"));
