import { createServer } from "node:http";
import { isAddress } from "viem";
import { config } from "./config.js";
import { createStore, toJson } from "./store.js";
import { fetchApi } from "./chain.js";
import { loadEcosystem } from "./ecosystem.js";
import { takeSnapshot, buildBoard, walletFromSnapshot, mergeReady } from "./snapshot.js";
import { createOrderBook, marketSummary } from "./orders.js";
import { createBot } from "./bot.js";

const store = createStore(config.dataDir);
let eco = null;
let snapshot = store.load("snapshot", null);
let board = null;
const book = createOrderBook(store);
const bot = createBot(store, { board: () => board });
const accountCache = new Map();
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function refreshEcosystem() {
  try {
    eco = await loadEcosystem();
    if (!eco.ok) log("identity mismatch", eco.checks.filter((c) => !c.ok));
  } catch (e) {
    log("ecosystem", e.message);
  }
}

async function refreshSnapshot() {
  if (!eco) return;
  try {
    snapshot = await takeSnapshot(eco);
    store.save("snapshot", snapshot);
    board = buildBoard(snapshot, eco);
    bot.onSnapshot(snapshot, eco);
    log(`snapshot ${snapshot.squeeks.length} squeeks, ${board.singles.length} singles`);
  } catch (e) {
    log("snapshot", e.message);
  }
}

async function refreshOrders() {
  try {
    await book.sync([bot.onOrderEvent]);
  } catch (e) {
    log("orders", e.message);
  }
}

async function account(addr) {
  const hit = accountCache.get(addr);
  if (hit && Date.now() - hit.at < 30_000) return hit.data;
  try {
    const data = await fetchApi(`/v1/accounts/${addr}`);
    accountCache.set(addr, { at: Date.now(), data });
    if (accountCache.size > 500) accountCache.delete(accountCache.keys().next().value);
    return data;
  } catch (e) {
    return { status: "unavailable", reason: e.message };
  }
}

function publicConfig() {
  if (!eco) return { status: "loading" };
  return {
    status: eco.ok ? "verified" : "mismatch",
    chainId: config.chainId,
    release: eco.release,
    contracts: { nft: eco.nft, sqk: eco.sqk, core: eco.core, staking: eco.staking, escrow: eco.escrow },
    maximumLevel: eco.maximumLevel,
    cooldownBlocks: eco.cooldownBlocks,
    basePower: eco.basePower,
    mergesOpen: eco.mergesOpen,
    checks: eco.checks,
    checkedAt: eco.checkedAt,
    coreHeight: snapshot?.coreHeight ?? null,
    snapshotAt: snapshot?.at ?? null,
    ordersThrough: book.state.through,
    telegramBot: config.telegramBotName || null,
  };
}

async function walletView(addr) {
  const a = addr.toLowerCase();
  const held = snapshot ? walletFromSnapshot(snapshot, a) : [];
  const acc = await account(a);
  const deposited = acc.status === "available" ? (acc.tokens ?? []).filter((t) => t.custody === "staking") : [];
  const height = snapshot?.coreHeight ?? 0;
  const squeeks = [
    ...held.map((s) => ({ ...s, custody: "wallet", mergeReady: eco ? mergeReady(s, eco, height) : false })),
    ...deposited.map((t) => ({
      id: Number(t.tokenId),
      owner: a,
      level: Number(t.level),
      nextMergeHeight: Number(t.nextMergeHeight ?? 0),
      custody: "staking",
      mergeReady: t.mergeState === "ready",
    })),
  ];
  return {
    address: a,
    coreHeight: height,
    squeeks,
    rewards: acc.rewards ?? null,
    power: acc.power ?? null,
    apiStatus: acc.status,
    orders: book.byMaker(a),
  };
}

const routes = [
  [/^\/api\/health$/, () => ({ ok: true, eco: Boolean(eco), snapshotAt: snapshot?.at, ordersThrough: book.state.through, bot: bot.enabled, subscribers: bot.subscribers() })],
  [/^\/api\/config$/, () => publicConfig()],
  [/^\/api\/board$/, () => board ?? { status: "loading" }],
  [/^\/api\/market$/, () => marketSummary(book, eco?.maximumLevel ?? 10)],
  [/^\/api\/orders$/, (_, q) => {
    const status = q.get("status") || "open";
    const all = Object.values(book.state.orders);
    return { orders: status === "all" ? all : all.filter((o) => o.status === status), through: book.state.through };
  }],
  [/^\/api\/orders\/(\d+)$/, (m) => book.state.orders[m[1]] ?? { status: "not_found" }],
  [/^\/api\/wallet\/(0x[0-9a-fA-F]{40})$/, (m) => (isAddress(m[1]) ? walletView(m[1]) : { error: "bad address" })],
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end('{"error":"method"}');
  }
  for (const [re, fn] of routes) {
    const m = url.pathname.match(re);
    if (!m) continue;
    try {
      return res.end(toJson(await fn(m, url.searchParams)));
    } catch (e) {
      res.statusCode = 500;
      return res.end(toJson({ error: e.message }));
    }
  }
  res.statusCode = 404;
  res.end('{"error":"not_found"}');
});

await refreshEcosystem();
if (snapshot && eco) board = buildBoard(snapshot, eco);
server.listen(config.port, "127.0.0.1", () => log(`listening on 127.0.0.1:${config.port}`));
refreshSnapshot();
refreshOrders();
bot.poll();
setInterval(refreshEcosystem, 10 * 60_000);
setInterval(refreshSnapshot, config.snapshotSeconds * 1000);
setInterval(refreshOrders, config.ordersSeconds * 1000);
