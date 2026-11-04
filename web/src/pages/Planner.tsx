import type { Abi, Address } from "viem";
import { ArrowRight } from "lucide-react";
import type { Config } from "../api";
import { escrowAbi } from "../chain";
import { useOrders, useRefresh, useWallet } from "../data";
import { same, sqk } from "../format";
import { bestPlans, cascade, countByLevel, power } from "../plan";
import { useApprovals, useTx } from "../tx";
import { Empty, Level, Notice, Section, TokenLink } from "../ui";

export default function Planner({ cfg, who, me, tradingOff }: { cfg: Config; who: string | null; me?: string; tradingOff: boolean }) {
  const wallet = useWallet(who);
  const orders = useOrders();
  const { run } = useTx();
  const approvals = useApprovals();
  const refresh = useRefresh();
  if (!who) return <Empty title="Connect or paste an address">The planner works from a wallet's Squeeks.</Empty>;
  if (wallet.isLoading || orders.isLoading) return <p className="muted">Planning…</p>;

  const held = (wallet.data?.squeeks ?? []).filter((s) => s.custody === "wallet");
  const counts = countByLevel(held, cfg.maximumLevel);
  const now = cascade(counts, cfg.maximumLevel);
  const asks = (orders.data ?? []).filter((o) => o.kind === "Ask" && o.fillable && !same(o.maker, who));
  const plans = bestPlans(counts, asks, cfg.maximumLevel, cfg.basePower);
  const isMe = same(me, who);
  const escrow = cfg.contracts.escrow as Address;

  const buy = async (ids: number[], cost: bigint) => {
    const pre = await approvals.sqk(cfg.contracts.sqk, escrow, cost);
    const fill =
      ids.length === 1
        ? { label: `Buy ask #${ids[0]}`, address: escrow, abi: escrowAbi as Abi, functionName: "fillAsk", args: [BigInt(ids[0])] }
        : { label: `Buy ${ids.length} Squeeks in one transaction`, address: escrow, abi: escrowAbi as Abi, functionName: "fillAsks", args: [ids.map(BigInt)] };
    run("Buy the path", [...pre, fill], refresh);
  };

  return (
    <div className="stack-large">
      <Section title="Where you stand">
        <div className="path-chain">
          {counts.slice(1, cfg.maximumLevel + 1).map((n, i) =>
            n ? (
              <div key={i} className="path-node">
                <Level l={i + 1} /> × {n}
              </div>
            ) : null,
          )}
        </div>
        <p className="muted">
          Wallet-held Squeeks only (Staking merges happen inside Staking). Merges you can already do: <strong>{now.merges}</strong>.
        </p>
      </Section>
      {!plans.length ? (
        <Notice tone="info">
          No listing completes a merge for you right now. Post a bid on the Trade tab and set a Telegram alert, and the board will come to you.
        </Notice>
      ) : (
        plans.map((p, i) => (
          <Section
            key={i}
            title={`Path ${i + 1}: ${p.steps.length} buy${p.steps.length > 1 ? "s" : ""} → ${p.merges} more merge${p.merges > 1 ? "s" : ""}`}
            aside={<strong>{sqk(p.cost)}</strong>}
          >
            <ol className="path-list">
              {p.steps.map((s) => (
                <li key={s.order.id}>
                  Buy <Level l={s.level} /> <TokenLink id={s.order.tokenId!} nft={cfg.contracts.nft} /> for {sqk(s.price)}
                </li>
              ))}
            </ol>
            <p>
              Power {p.powerBefore.toLocaleString("en-US")} <ArrowRight size={14} /> <strong>{p.powerAfter.toLocaleString("en-US")}</strong> after merging up
              {p.finalCounts.findLastIndex((n) => n > 0) > 0 && (
                <>
                  {" "}
                  (top Squeek: L{p.finalCounts.findLastIndex((n) => n > 0)})
                </>
              )}
              .
            </p>
            <p className="muted">
              Each merge starts that level's cooldown ({p.steps.map((s) => `L${s.level + 1}: ${(cfg.cooldownBlocks[s.level] ?? 0).toLocaleString("en-US")}`).join(", ")} Squeek blocks), so a long chain finishes over several hamster nights. Gain over buying nothing:{" "}
              {(p.powerAfter - power(now.counts, cfg.basePower)).toLocaleString("en-US")} power.
            </p>
            <button className="primary" disabled={!isMe || tradingOff} onClick={() => buy(p.steps.map((s) => s.order.id), p.cost)}>
              {isMe ? `Buy ${p.steps.length > 1 ? "all in one transaction" : "it"}` : "Connect this wallet to buy"}
            </button>
          </Section>
        ))
      )}
    </div>
  );
}
