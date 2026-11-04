import { useState } from "react";
import { useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { api, shareUrl, type Config } from "../api";
import { useBoard, useWants } from "../data";
import { same, until } from "../format";
import { Share } from "../share";
import { Addr, Level, Notice, Section, Tag } from "../ui";

export default function Wants({ cfg, me, go }: { cfg: Config; me?: string; go: (p: "trade") => void }) {
  const wants = useWants();
  const board = useBoard();
  const qc = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const [level, setLevel] = useState(1);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const focus = Number(new URLSearchParams(location.search).get("want")) || null;

  const post = async () => {
    if (!me) return;
    setBusy(true);
    setMsg(null);
    try {
      const address = me.toLowerCase();
      const expiresAt = Math.floor(Date.now() / 1000) + Math.min(30, Math.max(1, days)) * 86400;
      const message = await api.wantMessage({ address, level, count, note, expiresAt });
      const signature = await signMessageAsync({ message });
      await api.addWant({ address, level, count, note, expiresAt, signature });
      setMsg({ tone: "success", text: "Posted. Holders with a matching single get a Telegram ping." });
      setNote("");
      qc.invalidateQueries({ queryKey: ["wants"] });
    } catch (e) {
      setMsg({ tone: "error", text: /rejected|denied/i.test(String(e)) ? "You cancelled the signature." : (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: number) => {
    if (!me) return;
    try {
      const message = await api.wantMessage({ cancel: id, address: me.toLowerCase() });
      const signature = await signMessageAsync({ message });
      await api.cancelWant({ id, signature });
      qc.invalidateQueries({ queryKey: ["wants"] });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  };

  const list = [...(wants.data ?? [])].sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : b.createdAt - a.createdAt));
  const holders = (l: number) => board.data?.singles.filter((s) => s.level === l).length ?? 0;
  return (
    <Section title={`Looking for a partner (${list.length})`}>
      <p className="muted">Free requests: no SQK locked, just a wallet signature (no transaction, no gas). Holders with a single at that level hear about it.</p>
      {list.map((w) => (
        <div key={w.id} className={`holder-row ${w.id === focus ? "selected" : ""}`}>
          <Level l={w.level} />
          <span>
            {w.count > 1 ? `${w.count} × ` : ""}Level {w.level}
            {w.note && <span className="muted"> · “{w.note}”</span>}
          </span>
          <Addr a={w.address} me={me} />
          <span className="muted">{until(w.expiresAt)}</span>
          <Share url={shareUrl("w", w.id)} text={`Looking for a L${w.level} Squeek on SqueekMatch 🐹`} compact />
          {same(w.address, me) ? (
            <button onClick={() => cancel(w.id)}>Cancel</button>
          ) : (
            <button className="inline" onClick={() => go("trade")}>
              I have one
            </button>
          )}
        </div>
      ))}
      <div className="form-grid">
        <label className="field">
          <span>Level you need</span>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {Array.from({ length: cfg.maximumLevel - 1 }, (_, i) => (
              <option key={i} value={i + 1}>
                Level {i + 1} ({holders(i + 1)} singles out there)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>How many</span>
          <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Note (optional)</span>
          <input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paying well, merge-ready please" />
        </label>
        <label className="field">
          <span>Days open</span>
          <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="toolbar">
        <button className="primary" disabled={!me || busy} onClick={post}>
          {busy ? "Waiting for signature…" : "Post free request"}
        </button>
        {!me && <Tag>Connect a wallet to post</Tag>}
      </div>
    </Section>
  );
}
