import { useState } from "react";
import type { Config } from "../api";
import { useBoard, useMarket } from "../data";
import { sqk } from "../format";
import { Addr, Empty, Level, Section, Tag, TokenLink } from "../ui";

export default function Board({ cfg, me, go }: { cfg: Config; me?: string; go: (p: "trade") => void }) {
  const board = useBoard();
  const market = useMarket();
  const [level, setLevel] = useState<number | "all">("all");
  const [readyOnly, setReadyOnly] = useState(false);
  if (board.isLoading) return <p className="muted">Reading every Squeek on chain…</p>;
  if (!board.data?.singles) return <Empty title="Board is warming up">The server is taking its first snapshot. Refresh in a minute.</Empty>;
  const b = board.data;
  const rows = b.singles.filter((s) => (level === "all" || s.level === level) && (!readyOnly || s.mergeReady));
  const levelKeys = Object.keys(b.levels).map(Number).sort((x, y) => x - y);
  const bidFor = (l: number) => {
    const q = new URLSearchParams(location.search);
    q.set("bidLevel", String(l));
    history.replaceState(null, "", `?${q}`);
    go("trade");
  };

  return (
    <div className="stack-large">
      <Section title="By level" aside={<span className="muted">{b.holders.toLocaleString("en-US")} holders · updated {new Date(b.at).toLocaleTimeString()}</span>}>
        <table className="market-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Squeeks in wallets</th>
              <th>Singles</th>
              <th>Floor ask</th>
              <th>Best bid</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {levelKeys.map((l) => {
              const m = market.data?.levels.find((x) => x.level === l);
              return (
                <tr key={l}>
                  <td>
                    <Level l={l} />
                  </td>
                  <td>{b.levels[l].squeeks.toLocaleString("en-US")}</td>
                  <td>{b.levels[l].singles}</td>
                  <td>{sqk(m?.floorAsk)}</td>
                  <td>{sqk(m?.bestBid)}</td>
                  <td>
                    {l < cfg.maximumLevel && (
                      <button className="inline" onClick={() => bidFor(l)}>
                        Bid for L{l}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
      <Section
        title={`Lone Squeeks (${rows.length})`}
        aside={
          <div className="toolbar">
            <select value={level} onChange={(e) => setLevel(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="Level">
              <option value="all">All levels</option>
              {levelKeys.map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
            <label className="checkbox">
              <input type="checkbox" checked={readyOnly} onChange={(e) => setReadyOnly(e.target.checked)} /> Merge-ready only
            </label>
          </div>
        }
      >
        <p className="muted">
          A holder with an odd number of wallet-held Squeeks at a level has one without a partner. Two holders with singles at the same level can complete each other: one sells, one buys.
        </p>
        {rows.length ? (
          rows.slice(0, 300).map((s) => (
            <div key={`${s.owner}-${s.level}`} className="holder-row">
              <Level l={s.level} />
              <TokenLink id={s.tokenId} nft={cfg.contracts.nft} />
              <Addr a={s.owner} me={me} />
              {s.mergeReady ? <Tag tone="good">Merge-ready</Tag> : <Tag>Cooling down</Tag>}
              <button className="inline" onClick={() => bidFor(s.level)}>
                Make an offer
              </button>
            </div>
          ))
        ) : (
          <Empty title="No singles match this filter" />
        )}
      </Section>
    </div>
  );
}
