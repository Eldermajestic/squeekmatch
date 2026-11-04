import { isAddress } from "viem";
import { client } from "./chain.js";

const MAX_OPEN = 5;
const MAX_DAYS = 30;

export const wantMessage = (w) =>
  `SqueekMatch\nLooking for a Level ${w.level} Squeek${w.count > 1 ? ` (x${w.count})` : ""}${w.note ? `\nNote: ${w.note}` : ""}\nWallet: ${w.address}\nExpires: ${w.expiresAt}`;
export const cancelMessage = (id, address) => `SqueekMatch\nCancel request ${id}\nWallet: ${address}`;

export function createWants(store) {
  const state = store.load("wants", { next: 1, items: {} });
  const save = () => store.save("wants", state);
  const now = () => Math.floor(Date.now() / 1000);
  const open = () => Object.values(state.items).filter((w) => w.status === "open" && w.expiresAt > now());

  async function add(body, maximumLevel) {
    const address = String(body.address || "").toLowerCase();
    const level = Number(body.level);
    const count = Math.min(20, Math.max(1, Number(body.count) || 1));
    const expiresAt = Number(body.expiresAt);
    const note = String(body.note || "").replace(/[\r\n<>]/g, " ").slice(0, 80).trim();
    if (!isAddress(address)) throw new Error("bad address");
    if (!(level >= 1 && level < maximumLevel)) throw new Error("bad level");
    if (!(expiresAt > now() && expiresAt <= now() + MAX_DAYS * 86400)) throw new Error("bad expiry");
    const w = { address, level, count, note, expiresAt };
    const ok = await client.verifyMessage({ address, message: wantMessage(w), signature: body.signature });
    if (!ok) throw new Error("bad signature");
    if (open().filter((x) => x.address === address).length >= MAX_OPEN) throw new Error(`at most ${MAX_OPEN} open requests per wallet`);
    const id = state.next++;
    state.items[id] = { id, ...w, createdAt: now(), status: "open" };
    save();
    return state.items[id];
  }

  async function cancel(body) {
    const w = state.items[Number(body.id)];
    if (!w || w.status !== "open") throw new Error("not open");
    const ok = await client.verifyMessage({ address: w.address, message: cancelMessage(w.id, w.address), signature: body.signature });
    if (!ok) throw new Error("bad signature");
    w.status = "cancelled";
    save();
    return w;
  }

  return { add, cancel, open, get: (id) => state.items[id] };
}
