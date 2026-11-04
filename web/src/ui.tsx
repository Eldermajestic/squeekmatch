import { useState, type ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Copy, ExternalLink, Wallet as WalletIcon } from "lucide-react";
import { EXPLORER } from "./chain";
import { short } from "./format";

export function Addr({ a, me }: { a?: string | null; me?: string | null }) {
  if (!a) return <span>—</span>;
  const mine = me && a.toLowerCase() === me.toLowerCase();
  return (
    <a className="address" href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" title={a}>
      {mine ? "You" : short(a)}
    </a>
  );
}

export function TokenLink({ id, nft }: { id: number; nft?: string }) {
  return nft ? (
    <a className="token-number" href={`${EXPLORER}/nft/${nft}/${id}`} target="_blank" rel="noreferrer">
      #{id}
    </a>
  ) : (
    <span className="token-number">#{id}</span>
  );
}

export function Level({ l }: { l: number }) {
  return <span className="level-icon">L{l}</span>;
}

export function Tag({ children, tone }: { children: ReactNode; tone?: "good" | "warn" | "muted" }) {
  return <span className={`tag ${tone ?? ""}`}>{children}</span>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" | "success" }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <img src="/partners.svg" alt="" width={180} height={72} />
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="surface stack">
      <div className="section-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="icon-button"
      aria-label="Copy"
      onClick={() => navigator.clipboard.writeText(text).then(() => (setOk(true), setTimeout(() => setOk(false), 1200)))}
    >
      {ok ? "✓" : <Copy size={16} />}
    </button>
  );
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  if (isConnected)
    return (
      <div className="wallet-row">
        <a className="button" href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer">
          <WalletIcon size={16} /> {short(address)} <ExternalLink size={14} />
        </a>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  const unique = connectors.filter((c, i, all) => all.findIndex((x) => x.name === c.name) === i);
  return (
    <div className="wallet-row">
      <button className="wallet-button" onClick={() => setOpen((o) => !o)} disabled={isPending}>
        <WalletIcon size={16} /> {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="wallet-list surface">
          {unique.map((c) => (
            <button key={c.uid} onClick={() => (connect({ connector: c }), setOpen(false))}>
              {c.name}
            </button>
          ))}
          {error && <p className="muted">{error.message.split("\n")[0]}</p>}
        </div>
      )}
    </div>
  );
}
