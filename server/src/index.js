import { createServer } from "node:http";
import { isAddress } from "viem";
import { config } from "./config.js";
import { createStore, toJson } from "./store.js";
import { fetchApi } from "./chain.js";
import { loadEcosystem } from "./ecosystem.js";
import { takeSnapshot, buildBoard, walletFromSnapshot, mergeReady } from "./snapshot.js";
import { createOrderBook, marketSummary } from "./orders.js";
import { createBot } from "./bot.js";
import { createWants, wantMessage, cancelMessage } from "./wants.js";
import { renderCard, sharePage, orderText, wantText } from "./card.js";

const store = createStore(config.dataDir);
let eco = null;
let snapshot = store.load("snapshot", null);
let board = null;
const book = createOrderBook(store);
const bot = createBot(store, { board: () => board });
const accountCache = new Map();
const wants = createWants(store);
const cardCache = new Map();
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
    blocksPerDay: eco.blocksPerDay ?? null,
    sqkPerPowerPerDay: eco.sqkPerPowerPerDay ?? null,
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
  [/^\/api\/wants$/, () => ({ wants: wants.open() })],
  [/^\/api\/wants\/message$/, (_, q) =>
    q.get("cancel")
      ? { message: cancelMessage(Number(q.get("cancel")), (q.get("address") || "").toLowerCase()) }
      : { message: wantMessage({ address: (q.get("address") || "").toLowerCase(), level: Number(q.get("level")), count: Number(q.get("count")) || 1, note: (q.get("note") || "").replace(/[\r\n<>]/g, " ").slice(0, 80).trim(), expiresAt: Number(q.get("expiresAt")) }) }],
];

function shareFor(kind, id) {
  if (kind === "o") {
    const o = book.state.orders[id];
    if (!o) return null;
    const t = orderText(o);
    return { text: t, title: `${t.kicker}: ${t.title}`, description: `${t.value} on SqueekMatch, the Squeek merge-partner market.`, target: `${config.siteUrl}/?tab=trade&order=${id}` };
  }
  const w = wants.get(id);
  if (!w) return null;
  const t = wantText(w);
  return { text: t, title: `${t.kicker}: ${t.title}`, description: `${t.value} SqueekMatch finds Squeek merge partners.`, target: `${config.siteUrl}/?tab=board&want=${id}` };
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 4096) throw new Error("body too large");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-headers", "content-type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "POST" && /^\/api\/wants(\/cancel)?$/.test(url.pathname)) {
    try {
      if (limited(req.headers["x-forwarded-for"] || req.socket.remoteAddress)) throw new Error("slow down");
      const body = await readBody(req);
      if (url.pathname.endsWith("/cancel")) return res.end(toJson(await wants.cancel(body)));
      const w = await wants.add(body, eco?.maximumLevel ?? 10);
      bot.onWant(w);
      return res.end(toJson(w));
    } catch (e) {
      res.statusCode = 400;
      return res.end(toJson({ error: e.message }));
    }
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end('{"error":"method"}');
  }
  const share = url.pathname.match(/^\/api\/(o|w)\/(\d+)(\.png)?$/);
  if (share) {
    const info = shareFor(share[1], share[2]);
    if (!info) {
      res.statusCode = 404;
      return res.end('{"error":"not_found"}');
    }
    if (share[3]) {
      const key = `${share[1]}${share[2]}:${JSON.stringify(info.text)}`;
      let png = cardCache.get(key);
      if (!png) {
        png = renderCard(info.text);
        cardCache.set(key, png);
        if (cardCache.size > 300) cardCache.delete(cardCache.keys().next().value);
      }
      res.setHeader("content-type", "image/png");
      res.setHeader("cache-control", "public, max-age=300");
      return res.end(png);
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.end(sharePage({ ...info, image: `${config.siteUrl}/api/${share[1]}/${share[2]}.png` }));
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
