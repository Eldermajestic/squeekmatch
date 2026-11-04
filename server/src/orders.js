import { parseEventLogs } from "viem";
import { config, escrowAbi } from "./config.js";
import { client, escrowViewAbi, multicallChunks } from "./chain.js";

const CHUNK = 9_000n;
const CONFIRMATIONS = 2n;

export function createOrderBook(store) {
  const state = store.load("orders", { through: null, orders: {}, fills: [] });

  function apply(ev, listeners) {
    const a = ev.args;
    const at = { block: ev.blockNumber, tx: ev.transactionHash };
    const o = state.orders;
    switch (ev.eventName) {
      case "AskCreated":
        o[a.askId] = { id: Number(a.askId), kind: "Ask", maker: a.maker.toLowerCase(), tokenId: Number(a.tokenId), level: Number(a.level), price: a.price, expiresAt: Number(a.expiresAt), status: "open", fillable: true, createdTx: at.tx };
        break;
      case "BidCreated":
        o[a.bidId] = { id: Number(a.bidId), kind: "Bid", maker: a.maker.toLowerCase(), level: Number(a.level), mergeReady: a.mergeReady, amount: a.amount, expiresAt: Number(a.expiresAt), status: "open", fillable: true, createdTx: at.tx };
        break;
      case "SwapCreated":
        o[a.swapId] = { id: Number(a.swapId), kind: "Swap", maker: a.maker.toLowerCase(), tokenId: Number(a.makerTokenId), level: Number(a.makerLevel), wantedTokenId: Number(a.wantedTokenId), wantedLevel: Number(a.wantedLevel), mergeReady: a.mergeReady, sqkFromMaker: a.sqkFromMaker, sqkFromTaker: a.sqkFromTaker, expiresAt: Number(a.expiresAt), status: "open", fillable: true, createdTx: at.tx };
        break;
      case "AskFilled":
      case "BidFilled":
      case "SwapFilled": {
        const id = a.askId ?? a.bidId ?? a.swapId;
        const order = o[id];
        if (order) Object.assign(order, { status: "filled", taker: a.taker.toLowerCase(), filledTx: at.tx });
        state.fills.unshift({
          id: Number(id),
          kind: ev.eventName.replace("Filled", ""),
          maker: a.maker.toLowerCase(),
          taker: a.taker.toLowerCase(),
          tokenId: Number(a.tokenId ?? a.makerTokenId ?? 0),
          takerTokenId: a.takerTokenId !== undefined ? Number(a.takerTokenId) : undefined,
          level: order?.level,
          amount: a.price ?? a.amount ?? a.sqkFromTaker ?? 0n,
          block: at.block,
          tx: at.tx,
        });
        state.fills.length = Math.min(state.fills.length, 200);
        break;
      }
      case "AskCancelled":
      case "BidCancelled":
      case "SwapCancelled": {
        const id = a.askId ?? a.bidId ?? a.swapId;
        if (o[id]) Object.assign(o[id], { status: a.expired ? "expired" : "cancelled" });
        break;
      }
    }
    for (const fn of listeners) fn(ev, o[a.askId ?? a.bidId ?? a.swapId]);
  }

  async function sync(listeners = []) {
    if (!config.escrow) return;
    const head = (await client.getBlockNumber()) - CONFIRMATIONS;
    let from = state.through === null ? config.escrowFromBlock ?? head : state.through + 1n;
    const quiet = state.through === null;
    while (from <= head) {
      const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
      const logs = await client.getLogs({ address: config.escrow, fromBlock: from, toBlock: to });
      const events = parseEventLogs({ abi: escrowAbi, logs });
      for (const ev of events) apply(ev, quiet ? [] : listeners);
      state.through = to;
      from = to + 1n;
    }
    await refreshFillable();
    store.save("orders", state);
  }

  async function refreshFillable() {
    const now = Math.floor(Date.now() / 1000);
    const open = Object.values(state.orders).filter((o) => o.status === "open");
    for (const o of open) if (o.expiresAt <= now) o.status = "expired";
    const live = open.filter((o) => o.status === "open");
    if (!live.length) return;
    const res = await multicallChunks(
      live.map((o) => ({ address: config.escrow, abi: escrowViewAbi, functionName: "isFillable", args: [BigInt(o.id)] })),
    );
    live.forEach((o, i) => {
      if (res[i].status === "success") o.fillable = res[i].result;
    });
  }

  return {
    sync,
    state,
    open: () => Object.values(state.orders).filter((o) => o.status === "open"),
    byMaker: (addr) => Object.values(state.orders).filter((o) => o.maker === addr.toLowerCase()),
  };
}

export function marketSummary(book, maximumLevel) {
  const levels = [];
  const open = book.open().filter((o) => o.fillable);
  for (let l = 1; l <= maximumLevel; l++) {
    const asks = open.filter((o) => o.kind === "Ask" && o.level === l).map((o) => o.price);
    const bids = open.filter((o) => o.kind === "Bid" && o.level === l).map((o) => o.amount);
    const min = (xs) => xs.reduce((m, x) => (m === null || x < m ? x : m), null);
    const max = (xs) => xs.reduce((m, x) => (m === null || x > m ? x : m), null);
    levels.push({ level: l, floorAsk: min(asks), bestBid: max(bids), asks: asks.length, bids: bids.length });
  }
  const wanted = [...levels].sort((a, b) => b.bids - a.bids)[0];
  return { levels, lastFills: book.state.fills.slice(0, 20), mostWantedLevel: wanted?.bids ? wanted.level : null };
}
