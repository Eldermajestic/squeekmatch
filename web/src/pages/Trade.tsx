import { useState } from "react";
import type { Abi, Address } from "viem";
import type { Config, Order, Squeek } from "../api";
import { escrowAbi } from "../chain";
import { useOrders, useRefresh, useWallet } from "../data";
import { same, sqk, toUnits, until } from "../format";
import { useApprovals, useTx, type Step } from "../tx";
import { Addr, Empty, Level, Notice, Section, Tag, TokenLink } from "../ui";

type Props = { cfg: Config; me?: string; tradingOff: boolean };

function describe(o: Order) {
  if (o.kind === "Ask") return <>Sells <Level l={o.level} /> #{o.tokenId} for <strong>{sqk(o.price)}</strong></>;
  if (o.kind === "Bid") return <>Pays <strong>{sqk(o.amount)}</strong> for any <Level l={o.level} />{o.mergeReady ? " that is merge-ready" : ""}</>;
  const want = o.wantedTokenId ? `#${o.wantedTokenId}` : `any L${o.wantedLevel}${o.mergeReady ? " (merge-ready)" : ""}`;
  const extra = BigInt(o.sqkFromMaker ?? 0) > 0n ? ` + gives ${sqk(o.sqkFromMaker)}` : BigInt(o.sqkFromTaker ?? 0) > 0n ? ` + wants ${sqk(o.sqkFromTaker)}` : "";
  return <>Swaps <Level l={o.level} /> #{o.tokenId} for {want}{extra}</>;
}

export default function Trade({ cfg, me, tradingOff }: Props) {
  const orders = useOrders();
  const mine = useWallet(me);
  const { run } = useTx();
  const approvals = useApprovals();
  const refresh = useRefresh();
  const [kindFilter, setKindFilter] = useState<"all" | Order["kind"]>("all");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const escrow = cfg.contracts.escrow as Address;
  const call = (label: string, functionName: string, args: readonly unknown[]): Step => ({ label, address: escrow, abi: escrowAbi as Abi, functionName, args });
  const myWalletSqueeks = (mine.data?.squeeks ?? []).filter((s) => s.custody === "wallet");
  const height = mine.data?.coreHeight ?? cfg.coreHeight ?? 0;

  const open = (orders.data ?? []).filter((o) => o.fillable);
  const shown = open.filter((o) => (kindFilter === "all" || o.kind === kindFilter) && (levelFilter === "all" || o.level === levelFilter || o.wantedLevel === levelFilter));
  const myOpen = (orders.data ?? []).filter((o) => same(o.maker, me));

  async function fill(o: Order, tokenId?: number) {
    if (o.kind === "Ask") {
      const pre = await approvals.sqk(cfg.contracts.sqk, escrow, BigInt(o.price!));
      return run(`Buy #${o.tokenId}`, [...pre, call(`Buy ask #${o.id}`, "fillAsk", [BigInt(o.id)])], refresh);
    }
    if (!tokenId) return;
    const pre = await approvals.nft(cfg.contracts.nft, escrow);
    if (o.kind === "Bid") return run(`Sell #${tokenId}`, [...pre, call(`Fill bid #${o.id} with #${tokenId}`, "fillBid", [BigInt(o.id), BigInt(tokenId)])], refresh);
    const pay = await approvals.sqk(cfg.contracts.sqk, escrow, BigInt(o.sqkFromTaker ?? 0));
    run(`Swap for #${o.tokenId}`, [...pre, ...pay, call(`Fill swap #${o.id} with #${tokenId}`, "fillSwap", [BigInt(o.id), BigInt(tokenId)])], refresh);
  }

  const cancel = (o: Order) => run(`Cancel ${o.kind.toLowerCase()} #${o.id}`, [call(`Cancel #${o.id}`, `cancel${o.kind}`, [BigInt(o.id)])], refresh);

  return (
    <div className="stack-large">
      <Section
        title={`Open orders (${shown.length})`}
        aside={
          <div className="toolbar">
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as never)} aria-label="Order kind">
              <option value="all">All kinds</option>
              <option value="Ask">Asks</option>
              <option value="Bid">Bids</option>
              <option value="Swap">Swaps</option>
            </select>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="Level">
              <option value="all">All levels</option>
              {Array.from({ length: cfg.maximumLevel }, (_, i) => (
                <option key={i} value={i + 1}>
                  Level {i + 1}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {orders.isLoading ? (
          <p className="muted">Loading orders…</p>
        ) : !shown.length ? (
          <Empty title="No open orders yet">Be the first: list a Squeek or post a bid below.</Empty>
        ) : (
          shown.map((o) => <OrderRow key={o.id} o={o} me={me} cfg={cfg} squeeks={myWalletSqueeks} height={height} onFill={fill} disabled={tradingOff || !me} />)
        )}
      </Section>

      <CreateOrder cfg={cfg} me={me} squeeks={myWalletSqueeks} disabled={tradingOff || !me} call={call} />

      {me && (
        <Section title={`My orders (${myOpen.length})`}>
          {myOpen.length ? (
            myOpen.map((o) => (
              <div key={o.id} className="order-row">
                <Tag>{o.kind}</Tag>
                <span className="order-description">{describe(o)}</span>
                <span className="muted">{until(o.expiresAt)}</span>
                {!o.fillable && <Tag tone="warn">Not fillable</Tag>}
                <button onClick={() => cancel(o)}>Cancel</button>
              </div>
            ))
          ) : (
            <p className="muted">You have no open orders.</p>
          )}
        </Section>
      )}
    </div>
  );
}

function OrderRow({ o, me, cfg, squeeks, height, onFill, disabled }: { o: Order; me?: string; cfg: Config; squeeks: Squeek[]; height: number; onFill: (o: Order, t?: number) => void; disabled: boolean }) {
  const wantLevel = o.kind === "Bid" ? o.level : o.wantedLevel;
  const candidates =
    o.kind === "Ask"
      ? []
      : squeeks.filter((s) => (o.kind === "Swap" && o.wantedTokenId ? s.id === o.wantedTokenId : s.level === wantLevel) && (!o.mergeReady || (s.level < cfg.maximumLevel && s.nextMergeHeight <= height)));
  const [pick, setPick] = useState<number | undefined>(candidates[0]?.id);
  const own = same(o.maker, me);
  return (
    <div className="order-row">
      <Tag>{o.kind}</Tag>
      <span className="order-description">{describe(o)}</span>
      {o.tokenId ? <TokenLink id={o.tokenId} nft={cfg.contracts.nft} /> : null}
      <Addr a={o.maker} me={me} />
      <span className="muted">{until(o.expiresAt)}</span>
      {own ? (
        <Tag>Yours</Tag>
      ) : o.kind === "Ask" ? (
        <button className="primary" disabled={disabled} onClick={() => onFill(o)}>
          Buy
        </button>
      ) : candidates.length ? (
        <span className="toolbar">
          <select value={pick} onChange={(e) => setPick(Number(e.target.value))} aria-label="Your Squeek">
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id}
              </option>
            ))}
          </select>
          <button className="primary" disabled={disabled} onClick={() => onFill(o, pick)}>
            {o.kind === "Bid" ? "Sell" : "Swap"}
          </button>
        </span>
      ) : (
        <span className="muted">{me ? "No matching Squeek in your wallet" : "Connect to fill"}</span>
      )}
    </div>
  );
}

function CreateOrder({ cfg, me, squeeks, disabled, call }: { cfg: Config; me?: string; squeeks: Squeek[]; disabled: boolean; call: (l: string, f: string, a: readonly unknown[]) => Step }) {
  const initialLevel = Number(new URLSearchParams(location.search).get("bidLevel")) || 1;
  const [kind, setKind] = useState<Order["kind"]>(new URLSearchParams(location.search).get("bidLevel") ? "Bid" : "Ask");
  const [token, setToken] = useState<number | undefined>(squeeks[0]?.id);
  const [price, setPrice] = useState("");
  const [level, setLevel] = useState(initialLevel);
  const [mergeReady, setMergeReady] = useState(true);
  const [days, setDays] = useState(7);
  const [wantedId, setWantedId] = useState("");
  const [direction, setDirection] = useState<"none" | "give" | "want">("none");
  const { run } = useTx();
  const approvals = useApprovals();
  const refresh = useRefresh();
  const escrow = cfg.contracts.escrow as Address;
  const duration = BigInt(Math.min(30, Math.max(1, days)) * 86400);
  const amount = toUnits(price);
  const tokenSel = token ?? squeeks[0]?.id;

  async function submit() {
    if (kind === "Ask") {
      if (!tokenSel || !amount) return;
      const pre = await approvals.nft(cfg.contracts.nft, escrow);
      return run(`List #${tokenSel}`, [...pre, call(`List #${tokenSel} for ${sqk(amount)}`, "createAsk", [BigInt(tokenSel), amount, duration])], refresh);
    }
    if (kind === "Bid") {
      if (!amount) return;
      const pre = await approvals.sqk(cfg.contracts.sqk, escrow, amount);
      return run(`Bid for L${level}`, [...pre, call(`Escrow ${sqk(amount)} for any L${level}`, "createBid", [level, mergeReady, amount, duration])], refresh);
    }
    if (!tokenSel) return;
    const give = direction === "give" ? amount ?? 0n : 0n;
    const want = direction === "want" ? amount ?? 0n : 0n;
    const nftPre = await approvals.nft(cfg.contracts.nft, escrow);
    const sqkPre = await approvals.sqk(cfg.contracts.sqk, escrow, give);
    const wanted = wantedId.trim() ? BigInt(wantedId.trim()) : 0n;
    run(`Offer a swap`, [...nftPre, ...sqkPre, call(`Offer #${tokenSel} in a swap`, "createSwap", [BigInt(tokenSel), wanted, level, mergeReady, give, want, duration])], refresh);
  }

  const levels = Array.from({ length: cfg.maximumLevel }, (_, i) => i + 1);
  return (
    <Section title="Create an order">
      <div className="segmented" role="tablist">
        {(["Ask", "Bid", "Swap"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
            {k === "Ask" ? "Sell (ask)" : k === "Bid" ? "Buy any (bid)" : "Swap"}
          </button>
        ))}
      </div>
      {!me && <Notice tone="info">Connect a wallet to create orders.</Notice>}
      {me && kind !== "Bid" && !squeeks.length && (
        <Notice tone="warning">No Squeeks in this wallet. Squeeks deposited in Staking must be withdrawn in the Squeekchain app before they can be traded.</Notice>
      )}
      <div className="form-grid">
        {kind !== "Bid" && (
          <label className="field">
            <span>{kind === "Ask" ? "Squeek to sell" : "Squeek you give"}</span>
            <select value={tokenSel} onChange={(e) => setToken(Number(e.target.value))}>
              {squeeks.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} · L{s.level}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind !== "Ask" && (
          <label className="field">
            <span>{kind === "Bid" ? "Level you want" : "Level you want back"}</span>
            <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {levels.map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "Swap" && (
          <label className="field">
            <span>Specific Squeek id (optional)</span>
            <input value={wantedId} onChange={(e) => setWantedId(e.target.value.replace(/\D/g, ""))} placeholder="Any at that level" inputMode="numeric" />
          </label>
        )}
        {kind === "Swap" && (
          <label className="field">
            <span>SQK difference</span>
            <select value={direction} onChange={(e) => setDirection(e.target.value as never)}>
              <option value="none">No SQK</option>
              <option value="give">I add SQK</option>
              <option value="want">They add SQK</option>
            </select>
          </label>
        )}
        {(kind !== "Swap" || direction !== "none") && (
          <label className="field">
            <span>{kind === "Ask" ? "Price (SQK)" : kind === "Bid" ? "You pay (SQK, escrowed)" : "Amount (SQK)"}</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.0" inputMode="decimal" />
          </label>
        )}
        <label className="field">
          <span>Expires in (days)</span>
          <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
        {kind !== "Ask" && (
          <label className="checkbox">
            <input type="checkbox" checked={mergeReady} onChange={(e) => setMergeReady(e.target.checked)} /> Only accept a merge-ready Squeek (checked on chain at fill)
          </label>
        )}
      </div>
      <p className="muted">
        {kind === "Ask"
          ? "Your Squeek stays in your wallet until someone buys it. If you merge into it or move it, the listing stops filling."
          : kind === "Bid"
            ? "Your SQK is held by the escrow until a seller fills it or you cancel. Cancel any time for a full refund."
            : "Your Squeek stays in your wallet; only SQK you add is escrowed."}
      </p>
      <button className="primary" disabled={disabled || (kind !== "Bid" && !tokenSel) || ((kind !== "Swap" || direction !== "none") && !amount)} onClick={submit}>
        {kind === "Ask" ? "List it" : kind === "Bid" ? "Post bid" : "Offer swap"}
      </button>
    </Section>
  );
}
