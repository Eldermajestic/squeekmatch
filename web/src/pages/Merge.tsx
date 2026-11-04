import { useState } from "react";
import type { Abi } from "viem";
import type { Config, Squeek } from "../api";
import { nftAbi, stakingAbi } from "../chain";
import { useRefresh, useWallet } from "../data";
import { blocksLeft } from "../format";
import { useTx } from "../tx";
import { Empty, Level, Notice, Section, Tag, TokenLink } from "../ui";

export default function Merge({ cfg, me }: { cfg: Config; me?: string }) {
  const wallet = useWallet(me);
  const { run } = useTx();
  const refresh = useRefresh();
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [keep, setKeep] = useState<number | null>(null);
  if (!me) return <Empty title="Connect a wallet to merge">Merging needs the owner's signature.</Empty>;
  if (wallet.isLoading) return <p className="muted">Reading your Squeeks…</p>;
  const all = (wallet.data?.squeeks ?? []).filter((s) => s.level < cfg.maximumLevel);
  const height = wallet.data?.coreHeight ?? 0;
  const byId = new Map(all.map((s) => [s.id, s]));
  const first = a !== null ? byId.get(a) : undefined;
  const partners = first ? all.filter((s) => s.id !== first.id && s.level === first.level && s.custody === first.custody) : [];
  const second = b !== null ? byId.get(b) : undefined;
  const l = first?.level ?? 0;
  const ready = first?.mergeReady && second?.mergeReady && cfg.mergesOpen;
  const survivor = keep ?? first?.id;
  const donor = survivor === first?.id ? second?.id : first?.id;

  const merge = () => {
    if (!first || !second || !survivor || !donor) return;
    const step =
      first.custody === "staking"
        ? { label: `Merge #${donor} into #${survivor} (in Staking)`, address: cfg.contracts.staking, abi: stakingAbi as Abi, functionName: "mergeDeposited", args: [cfg.contracts.nft, BigInt(survivor), BigInt(donor)] }
        : { label: `Merge #${donor} into #${survivor}`, address: cfg.contracts.nft, abi: nftAbi as Abi, functionName: "merge", args: [BigInt(survivor), BigInt(donor)] };
    run("Merge", [step], () => {
      setA(null);
      setB(null);
      setKeep(null);
      refresh();
    });
  };

  const pick = (s: Squeek) => {
    if (a === null || (a !== null && b !== null)) {
      setA(s.id);
      setB(null);
      setKeep(null);
    } else if (s.id !== a) setB(s.id);
  };

  return (
    <div className="stack-large">
      {!cfg.mergesOpen && <Notice tone="warning">Squeekchain has merges closed right now.</Notice>}
      <Section title="1. Pick two Squeeks of the same level">
        {!all.length ? (
          <Empty title="Nothing to merge">You need two Squeeks of the same level, both in your wallet or both in Staking.</Empty>
        ) : (
          <div className="inventory-grid">
            {all.map((s) => {
              const sel = s.id === a || s.id === b;
              const allowed = a === null || b !== null || s.id === a || partners.some((p) => p.id === s.id);
              return (
                <button key={s.id} className={`token-row ${sel ? "selected" : ""}`} aria-pressed={sel} disabled={!allowed} onClick={() => pick(s)}>
                  <Level l={s.level} /> #{s.id}
                  <Tag tone={s.mergeReady ? "good" : undefined}>{s.mergeReady ? "Ready" : `${blocksLeft(s.nextMergeHeight, height)} blocks`}</Tag>
                  {s.custody === "staking" && <Tag tone="muted">Staking</Tag>}
                </button>
              );
            })}
          </div>
        )}
      </Section>
      {first && second && (
        <Section title="2. Choose the survivor">
          <div className="segmented">
            {[first, second].map((s) => (
              <button key={s.id} aria-selected={survivor === s.id} onClick={() => setKeep(s.id)}>
                Keep <TokenLink id={s.id} />
              </button>
            ))}
          </div>
          <div className="merge-result">
            <p>
              <Level l={l} /> + <Level l={l} /> → <Level l={l + 1} /> #{survivor}
            </p>
            <p>
              Power {(2 * (cfg.basePower[l - 1] ?? 0)).toLocaleString("en-US")} → <strong>{(cfg.basePower[l] ?? 0).toLocaleString("en-US")}</strong> (+
              {((cfg.basePower[l] ?? 0) - 2 * (cfg.basePower[l - 1] ?? 0)).toLocaleString("en-US")}), from the next round.
            </p>
            <p className="muted">
              #{donor} is burned permanently. #{survivor} can merge again after {(cfg.cooldownBlocks[l] ?? 0).toLocaleString("en-US")} Squeek blocks.
            </p>
          </div>
          {!ready && <Notice tone="warning">One of these is still cooling down, so the merge would fail. Try again later.</Notice>}
          <button className="primary" disabled={!ready} onClick={merge}>
            Merge
          </button>
        </Section>
      )}
    </div>
  );
}
