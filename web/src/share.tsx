import { useState } from "react";
import { Share2 } from "lucide-react";

export function Share({ url, text, compact }: { url: string; text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return (
    <span className="share">
      <a className="button" href={x} target="_blank" rel="noreferrer" aria-label="Share on X">
        <Share2 size={14} /> {compact ? "" : "Post"}
      </a>
      {!compact && (
        <button
          onClick={() =>
            navigator.clipboard
              .writeText(url)
              .then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
              .catch(() => null)
          }
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      )}
    </span>
  );
}
