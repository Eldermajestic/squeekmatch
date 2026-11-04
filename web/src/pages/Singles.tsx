import { useState } from "react";
import { Search } from "lucide-react";
import { isAddress } from "viem";
import type { Config, Squeek } from "../api";
import { useWallet } from "../data";
import { blocksLeft, sqk } from "../format";
import { pairGain } from "../plan";
import { Empty, Level, Notice, Section, Tag, TokenLink } from "../ui";

type Props = { cfg: Config; who: string | null; setViewed: (a: string | null) => void; me?: string; go: (p: "planner" | "board" | "trade" | "merge" | "alerts") => void };

export default function Singles({ cfg, who, setViewed, me, go }: Props) {
  const [input, setInput] = useState(who ?? "");
  const wallet = useWallet(who);
  const submit = () => {
    const v = input.trim();
    if (isAddress(v)) setViewed(v.toLowerCase());
  };

  const groups = new Map<number, Squeek[]>();
  for (const s of wallet.data?.squeeks ?? []) (groups.get(s.level) ?? groups.set(s.level, []).get(s.level)!).push(s);
  const levels = [...groups.keys()].sort((a, b) => a - b);
  const split = (l: number) => {
    const list = groups.get(l) ?? [];
    const w = list.filter((s) => s.custody === "wallet").length;
    const st = list.length - w;
    return { w, st, pairs: Math.floor(w / 2) + Math.floor(st / 2), single: l < cfg.maximumLevel && (w % 2 === 1 || st % 2 === 1) };
  };
  const singles = levels.filter((l) => split(l).single);
  const lost = singles.reduce((p, l) => p + pairGain(l, cfg.basePower), 0);
  const height = wallet.data?.coreHeight ?? cfg.coreHeight ?? 0;

  return (
    <div className="stack-large">
      <Section title="Find your singles" aside={<Tag>Read-only lookup</Tag>}>
        <form
          className="lookup"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>Wallet address</span>
            <input className="address-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste an Ethereum address" spellCheck={false} />
          </label>
          <div className="toolbar">
            <button className="primary" type="submit" disabled={!isAddress(input.trim())}>
              <Search size={16} /> Find singles
            </button>
            {me && who?.toLowerCase() !== me.toLowerCase() && (
              <button type="button" onClick={() => (setViewed(null), setInput(me))}>
                Use my wallet
              </button>
            )}
          </div>
          <p className="field-hint">No connection needed to look. No signature requested.</p>
        </form>
      </Section>

      {!who ? (
        <Empty title="A small match. More power.">Paste an address or connect a wallet to see Squeeks left without a partner.</Empty>
      ) : wallet.isLoading ? (
        <p className="muted">Reading Squeeks…</p>
      ) : wallet.isError ? (
        <Notice tone="error">Couldn't read this wallet. Try again.</Notice>
      ) : !wallet.data?.squeeks.length ? (
        <Empty title="No Squeeks here">This address holds no Squeeks in its wallet or in Staking.</Empty>
      ) : (
        <>
          <div className="portfolio-summary">
            <div>
              <span className="muted">Squeeks</span>
              <strong className="balance-number">{wallet.data.squeeks.length}</strong>
            </div>
            <div>
              <span className="muted">Singles</span>
              <strong className="balance-number">{singles.length}</strong>
            </div>
            <div>
              <span className="muted">Power waiting for a partner</span>
              <strong className="balance-number">+{lost.toLocaleString("en-US")}</strong>
            </div>
            {wallet.data.rewards?.claimableBaseUnits && (
              <div>
                <span className="muted">Claimable</span>
                <strong className="balance-number">{sqk(wallet.data.rewards.claimableBaseUnits)}</strong>
              </div>
            )}
          </div>
          {singles.length > 0 && (
            <Notice tone="info">
              {singles.length} level{singles.length > 1 ? "s have" : " has"} a lone Squeek.{" "}
              <button className="inline" onClick={() => go("planner")}>
                Plan the cheapest path
              </button>{" "}
              or{" "}
              <button className="inline" onClick={() => go("alerts")}>
                get a Telegram ping
              </button>{" "}
              when a match is listed.
            </Notice>
          )}
          {wallet.data.apiStatus !== "available" && <Notice tone="warning">Staking data is unavailable right now; showing wallet-held Squeeks only.</Notice>}
          <Section title="Holdings by level" aside={<button onClick={() => go("merge")}>Merge a pair</button>}>
            <div className="level-list">
              {levels.map((l) => {
                const list = groups.get(l)!;
                const { pairs, single, w, st } = split(l);
                return (
                  <div key={l} className="level-group">
                    <div className="section-head">
                      <h3>
                        <Level l={l} /> Level {l}
                      </h3>
                      <span>
                        {single && <Tag tone="warn">{w % 2 && st % 2 ? "2 singles" : "Single"}: +{pairGain(l, cfg.basePower).toLocaleString("en-US")} power each if paired</Tag>}{" "}
                        {pairs > 0 && <Tag tone="good">{pairs} pair{pairs > 1 ? "s" : ""}</Tag>}
                      </span>
                    </div>
                    {list.map((s) => (
                      <div key={s.id} className="token-row">
                        <TokenLink id={s.id} nft={cfg.contracts.nft} />
                        <Tag tone={s.custody === "staking" ? "muted" : undefined}>{s.custody === "staking" ? "In Staking" : "In wallet"}</Tag>
                        <span className="muted">
                          {l >= cfg.maximumLevel
                            ? "Max level"
                            : s.mergeReady
                              ? "Ready to merge"
                              : `Cooldown: ${blocksLeft(s.nextMergeHeight, height).toLocaleString("en-US")} Squeek blocks`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
