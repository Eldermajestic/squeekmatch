import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Bell, GitMerge, LayoutGrid, ListFilter, Route, ShieldAlert, Sprout } from "lucide-react";
import { useConfig } from "./data";
import { Notice, WalletButton } from "./ui";
import Singles from "./pages/Singles";
import Planner from "./pages/Planner";
import Board from "./pages/Board";
import Trade from "./pages/Trade";
import Merge from "./pages/Merge";
import Alerts from "./pages/Alerts";

const pages = [
  { id: "singles", name: "My singles", icon: LayoutGrid, title: "My singles", lead: "Find the missing match for your next merge." },
  { id: "planner", name: "Chain planner", icon: Route, title: "Chain planner", lead: "The fewest buys that unlock the most merges." },
  { id: "board", name: "Match board", icon: Sprout, title: "Match board", lead: "Every holder's lone Squeek, by level." },
  { id: "trade", name: "Trade", icon: ListFilter, title: "Trade, peer to peer", lead: "Asks, bids and swaps. No fees, no custody." },
  { id: "merge", name: "Merge", icon: GitMerge, title: "Two Squeeks. One stronger.", lead: "Pick a pair, choose the survivor, sign." },
  { id: "alerts", name: "Alerts", icon: Bell, title: "Telegram alerts", lead: "Know the moment your match appears." },
] as const;
type PageId = (typeof pages)[number]["id"];

const params = () => new URLSearchParams(location.search);

export default function App() {
  const { address } = useAccount();
  const config = useConfig();
  const [tab, setTab] = useState<PageId>(() => (pages.find((p) => p.id === params().get("tab"))?.id ?? "singles") as PageId);
  const [viewed, setViewed] = useState<string | null>(() => params().get("address"));
  const who = viewed ?? address ?? null;

  useEffect(() => {
    const q = params();
    q.set("tab", tab);
    if (viewed) q.set("address", viewed);
    else q.delete("address");
    history.replaceState(null, "", `?${q}`);
  }, [tab, viewed]);

  const page = pages.find((p) => p.id === tab)!;
  const cfg = config.data;
  const ready = cfg && cfg.status !== "loading";
  const tradingOff = ready && (cfg.status !== "verified" || !cfg.contracts.escrow);
  const go = (id: PageId) => {
    setTab(id);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="testnet-strip">Sepolia testnet · Test SQK only, no real value</div>
      <header className="app-header">
        <a className="brand" href="/" aria-label="SqueekMatch home">
          <img src="/favicon.svg" alt="" width={36} height={36} />
          <span>
            Squeek<span className="brand-light">Match</span>
          </span>
        </a>
        <WalletButton />
      </header>
      <nav className="main-nav" aria-label="Sections">
        {pages.map((p) => (
          <button key={p.id} aria-current={tab === p.id ? "page" : undefined} onClick={() => go(p.id)}>
            <p.icon size={18} aria-hidden /> {p.name}
          </button>
        ))}
      </nav>
      <main id="main" className="workspace">
        <div className="page-heading">
          <h1>{page.title}</h1>
          <p className="muted">{page.lead}</p>
        </div>
        {config.isError && <Notice tone="error">The SqueekMatch server is unreachable right now. Try again in a minute.</Notice>}
        {tradingOff && (
          <Notice tone="warning">
            <ShieldAlert size={16} /> Trading is paused:{" "}
            {!cfg.contracts.escrow ? "the escrow contract isn't configured yet." : "Squeekchain's contracts don't match the escrow. Reads still work."}
          </Notice>
        )}
        {!ready ? (
          <p className="muted">Loading Squeekchain…</p>
        ) : tab === "singles" ? (
          <Singles cfg={cfg} who={who} setViewed={setViewed} me={address} go={go} />
        ) : tab === "planner" ? (
          <Planner cfg={cfg} who={who} me={address} tradingOff={!!tradingOff} />
        ) : tab === "board" ? (
          <Board cfg={cfg} me={address} go={go} />
        ) : tab === "trade" ? (
          <Trade cfg={cfg} me={address} tradingOff={!!tradingOff} />
        ) : tab === "merge" ? (
          <Merge cfg={cfg} me={address} />
        ) : (
          <Alerts cfg={cfg} who={who} />
        )}
      </main>
      <footer className="app-footer muted">
        <p>
          SqueekMatch is fan-made and unofficial · Escrow{" "}
          {cfg?.contracts.escrow ? (
            <a href={`https://sepolia.etherscan.io/address/${cfg.contracts.escrow}#code`} target="_blank" rel="noreferrer">
              {cfg.contracts.escrow}
            </a>
          ) : (
            "not deployed"
          )}{" "}
          · No fees, no owner ·{" "}
          <a href="https://github.com/Eldermajestic/squeekmatch" target="_blank" rel="noreferrer">
            Source
          </a>{" "}
          ·{" "}
          <a href="https://docs.squeekchain.com" target="_blank" rel="noreferrer">
            Squeekchain docs
          </a>
        </p>
      </footer>
    </div>
  );
}
