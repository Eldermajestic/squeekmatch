import { Bell, Send } from "lucide-react";
import type { Config } from "../api";
import { short } from "../format";
import { Notice, Section } from "../ui";

export default function Alerts({ cfg, who }: { cfg: Config; who: string | null }) {
  const bot = cfg.telegramBot;
  const link = bot ? `https://t.me/${bot}${who ? `?start=${who}` : ""}` : null;
  return (
    <div className="stack-large">
      <Section title="Never miss your match">
        <ul className="facts">
          <li>🧩 A Squeek that pairs one of your singles is listed</li>
          <li>💰 Someone bids for a level where you hold a single</li>
          <li>✅ One of your orders fills</li>
          <li>⚡ Two of your Squeeks become ready to merge</li>
        </ul>
        {link ? (
          <>
            <a className="button primary" href={link} target="_blank" rel="noreferrer">
              <Send size={16} /> Open @{bot} {who ? `for ${short(who)}` : ""}
            </a>
            <p className="muted">
              {who ? "The bot will start watching this wallet as soon as you press Start." : "Then send /watch followed by your wallet address."} Read-only: the bot never asks for a signature or a key.
            </p>
          </>
        ) : (
          <Notice tone="info">
            <Bell size={16} /> Alerts are being set up.
          </Notice>
        )}
      </Section>
    </div>
  );
}
