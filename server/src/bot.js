import { formatUnits, isAddress } from "viem";
import { config } from "./config.js";
import { mergeReady } from "./snapshot.js";

const sqk = (v) => `${Number(formatUnits(BigInt(v ?? 0), 18)).toLocaleString("en-US", { maximumFractionDigits: 2 })} SQK`;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function createBot(store, ctx) {
  const token = config.telegramToken;
  const subs = store.load("subs", {});
  const pairMemo = store.load("pairmemo", {});
  let offset = 0;
  const save = () => store.save("subs", subs);

  async function tg(method, body) {
    if (!token) return null;
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(method === "getUpdates" ? 40_000 : 15_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok && j.error_code === 403 && body.chat_id) {
      delete subs[body.chat_id];
      save();
    }
    return j;
  }

  const send = (chatId, text) =>
    tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }).catch(() => null);

  function watchers(addr) {
    const a = addr.toLowerCase();
    return Object.entries(subs).filter(([, s]) => s.wallets.includes(a)).map(([id]) => id);
  }

  function singlesOf(addr) {
    return (ctx.board()?.singles ?? []).filter((s) => s.owner === addr.toLowerCase());
  }

  const help =
    "🐹 <b>SqueekMatch alerts</b>\n\n" +
    "/watch 0xYourWallet — get alerts for a wallet\n" +
    "/unwatch 0xYourWallet — stop alerts for it\n" +
    "/list — wallets you watch\n" +
    "/stop — stop all alerts\n\n" +
    "You'll hear when a Squeek that pairs one of your singles is listed, when someone bids for your level, when your orders fill, and when two of your Squeeks are ready to merge.";

  async function handle(msg) {
    const chatId = String(msg.chat.id);
    const [cmdRaw, arg] = (msg.text || "").trim().split(/\s+/);
    const cmd = cmdRaw?.split("@")[0];
    subs[chatId] ??= { wallets: [] };
    const sub = subs[chatId];
    const addWallet = async (a) => {
      if (!a || !isAddress(a)) return send(chatId, "Send a wallet address, e.g. /watch 0x1234…");
      const w = a.toLowerCase();
      if (!sub.wallets.includes(w)) sub.wallets.push(w);
      if (sub.wallets.length > 5) sub.wallets.shift();
      save();
      const singles = singlesOf(w);
      const extra = singles.length
        ? `\n\nSingles right now: ${singles.map((s) => `L${s.level} #${s.tokenId}`).join(", ")}`
        : "\n\nNo wallet-held singles right now.";
      return send(chatId, `✅ Watching <code>${short(w)}</code>.${extra}\n\n${config.siteUrl}/?address=${w}`);
    };
    if (cmd === "/start") return arg && isAddress(arg) ? addWallet(arg) : send(chatId, help);
    if (cmd === "/watch") return addWallet(arg);
    if (cmd === "/unwatch") {
      sub.wallets = sub.wallets.filter((w) => w !== (arg || "").toLowerCase());
      save();
      return send(chatId, "Removed.");
    }
    if (cmd === "/list")
      return send(chatId, sub.wallets.length ? sub.wallets.map((w) => `• <code>${w}</code>`).join("\n") : "You watch no wallets yet. /watch 0x…");
    if (cmd === "/stop") {
      delete subs[chatId];
      save();
      return send(chatId, "Alerts stopped. /start to come back.");
    }
    return send(chatId, help);
  }

  async function poll() {
    if (!token) return;
    for (;;) {
      try {
        const j = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
        for (const u of j?.result ?? []) {
          offset = u.update_id + 1;
          if (u.message?.text) await handle(u.message).catch(() => null);
        }
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  function onOrderEvent(ev, order) {
    if (!token || !order) return;
    const link = `${config.siteUrl}/?tab=trade&order=${order.id}`;
    if (ev.eventName === "AskCreated") {
      for (const [chatId, s] of Object.entries(subs)) {
        for (const w of s.wallets) {
          if (w === order.maker) continue;
          const single = singlesOf(w).find((x) => x.level === order.level);
          if (single)
            send(chatId, `🧩 L${order.level} Squeek #${order.tokenId} listed for ${sqk(order.price)}.\nIt pairs your single #${single.tokenId}.\n${link}`);
        }
      }
    }
    if (ev.eventName === "BidCreated") {
      for (const [chatId, s] of Object.entries(subs)) {
        for (const w of s.wallets) {
          if (w === order.maker) continue;
          const single = singlesOf(w).find((x) => x.level === order.level);
          if (single)
            send(chatId, `💰 New bid: ${sqk(order.amount)} for any L${order.level} Squeek${order.mergeReady ? " (merge-ready)" : ""}.\nYour single #${single.tokenId} could fill it.\n${link}`);
        }
      }
    }
    if (ev.eventName.endsWith("Filled")) {
      for (const chatId of watchers(order.maker))
        send(chatId, `✅ Your ${order.kind.toLowerCase()} #${order.id} was filled by <code>${short(order.taker)}</code>.${order.kind === "Bid" ? " Your new Squeek is in your wallet, pair it now:" : ""}\n${config.siteUrl}/?tab=merge`);
    }
  }

  function onWant(w) {
    if (!token) return;
    for (const [chatId, s] of Object.entries(subs)) {
      for (const wallet of s.wallets) {
        if (wallet === w.address) continue;
        const single = singlesOf(wallet).find((x) => x.level === w.level);
        if (single)
          send(chatId, `🔎 <code>${short(w.address)}</code> is looking for a L${w.level} Squeek${w.count > 1 ? ` (x${w.count})` : ""}.${w.note ? `\n“${w.note}”` : ""}\nYour single #${single.tokenId} fits. List it or offer a swap:\n${config.siteUrl}/?tab=trade`);
      }
    }
  }

  function onSnapshot(snapshot, eco) {
    if (!token) return;
    const wallets = new Set(Object.values(subs).flatMap((s) => s.wallets));
    for (const w of wallets) {
      const mine = snapshot.squeeks.filter((s) => s.owner === w && mergeReady(s, eco, snapshot.coreHeight));
      const byLevel = {};
      for (const s of mine) (byLevel[s.level] ??= []).push(s.id);
      const pairs = Object.entries(byLevel).filter(([, ids]) => ids.length >= 2).map(([l, ids]) => `L${l}: #${ids[0]} + #${ids[1]}`);
      const key = pairs.join("|");
      if (pairs.length && pairMemo[w] !== key)
        for (const chatId of watchers(w)) send(chatId, `⚡ Ready to merge in <code>${short(w)}</code>:\n${pairs.join("\n")}\n${config.siteUrl}/?tab=merge&address=${w}`);
      pairMemo[w] = key;
    }
    store.save("pairmemo", pairMemo);
  }

  return { poll, onOrderEvent, onSnapshot, onWant, enabled: Boolean(token), subscribers: () => Object.keys(subs).length };
}
