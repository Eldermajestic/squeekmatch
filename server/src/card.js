import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { formatUnits } from "viem";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const fonts = ["DMSans_400Regular.ttf", "DMSans_700Bold.ttf"].map((f) => resolve(here, "../assets", f));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sqk = (v) => `${Number(formatUnits(BigInt(v ?? 0), 18)).toLocaleString("en-US", { maximumFractionDigits: 2 })} SQK`;

export function orderText(o) {
  if (o.kind === "Ask") return { kicker: "For sale", title: `Level ${o.level} Squeek #${o.tokenId}`, value: sqk(o.price) };
  if (o.kind === "Bid") return { kicker: "Buying", title: `Any Level ${o.level} Squeek${o.mergeReady ? ", merge-ready" : ""}`, value: sqk(o.amount) };
  const want = o.wantedTokenId ? `#${o.wantedTokenId}` : `any L${o.wantedLevel}`;
  const extra = BigInt(o.sqkFromMaker ?? 0) > 0n ? `+ ${sqk(o.sqkFromMaker)}` : BigInt(o.sqkFromTaker ?? 0) > 0n ? `wants + ${sqk(o.sqkFromTaker)}` : "straight swap";
  return { kicker: "Swap", title: `L${o.level} #${o.tokenId} for ${want}`, value: extra };
}

export function wantText(w) {
  return { kicker: "Looking for a partner", title: `Level ${w.level} Squeek${w.count > 1 ? ` x${w.count}` : ""}`, value: w.note || "Have one? Make an offer." };
}

function hamster(x, y, fill) {
  return `<g transform="translate(${x} ${y})"><circle cx="-34" cy="-46" r="20" fill="${fill}" stroke="#203c31" stroke-width="5"/><circle cx="34" cy="-46" r="20" fill="${fill}" stroke="#203c31" stroke-width="5"/><ellipse cx="0" cy="0" rx="62" ry="58" fill="${fill}" stroke="#203c31" stroke-width="5"/><circle cx="-20" cy="-8" r="6" fill="#203c31"/><circle cx="20" cy="-8" r="6" fill="#203c31"/><ellipse cx="0" cy="18" rx="22" ry="16" fill="#fffef9"/><path d="M-6 12 L6 12 L0 18 Z" fill="#203c31"/></g>`;
}

export function renderCard({ kicker, title, value }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f7f0"/>
  <rect x="40" y="40" width="1120" height="550" rx="36" fill="#fffef9" stroke="#dedfd2" stroke-width="3"/>
  <text x="96" y="140" font-family="DM Sans" font-size="40" font-weight="700" fill="#203c31">Squeek<tspan font-weight="400">Match</tspan></text>
  <text x="96" y="250" font-family="DM Sans" font-size="34" fill="#607065">${esc(kicker)}</text>
  <text x="96" y="330" font-family="DM Sans" font-size="64" font-weight="700" fill="#203c31">${esc(title).slice(0, 34)}</text>
  <rect x="96" y="380" width="${Math.min(640, 60 + esc(value).length * 26)}" height="84" rx="20" fill="#e5edb0"/>
  <text x="126" y="436" font-family="DM Sans" font-size="40" font-weight="700" fill="#203c31">${esc(value).slice(0, 26)}</text>
  <text x="96" y="545" font-family="DM Sans" font-size="28" fill="#607065">squeekmatch.xyz · Squeekchain · Sepolia testnet</text>
  ${hamster(880, 360, "#e5edb0")}${hamster(1030, 360, "#f3cfa4")}
  <circle cx="955" cy="360" r="16" fill="#fffef9" stroke="#607065" stroke-width="3" stroke-dasharray="5 4"/>
  <text x="955" y="368" text-anchor="middle" font-family="DM Sans" font-size="24" fill="#607065">+</text>
</svg>`;
  return new Resvg(svg, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "DM Sans" } }).render().asPng();
}

export function sharePage({ title, description, image, target }) {
  const t = esc(title);
  const d = esc(description);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t}</title>
<meta name="description" content="${d}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0; url=${target}"></head><body><a href="${target}">Open on SqueekMatch</a></body></html>`;
}

export const cardFont = readFileSync(fonts[0]).length > 0;
