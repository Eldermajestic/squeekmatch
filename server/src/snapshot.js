import { client, coreHeight, multicallChunks, nftAbi } from "./chain.js";

export async function takeSnapshot(eco) {
  const issued = Number(await client.readContract({ address: eco.nft, abi: nftAbi, functionName: "totalIssued" }));
  const ids = Array.from({ length: issued }, (_, i) => BigInt(i + 1));
  const calls = ids.flatMap((id) => [
    { address: eco.nft, abi: nftAbi, functionName: "ownerOf", args: [id] },
    { address: eco.nft, abi: nftAbi, functionName: "level", args: [id] },
    { address: eco.nft, abi: nftAbi, functionName: "nextMergeHeight", args: [id] },
  ]);
  const [res, height] = await Promise.all([multicallChunks(calls), coreHeight(eco.core)]);
  const squeeks = [];
  for (let i = 0; i < ids.length; i++) {
    const [o, l, n] = res.slice(i * 3, i * 3 + 3);
    if (o.status !== "success" || l.status !== "success") continue;
    squeeks.push({
      id: Number(ids[i]),
      owner: o.result.toLowerCase(),
      level: Number(l.result),
      nextMergeHeight: n.status === "success" ? Number(n.result) : 0,
    });
  }
  return { at: Date.now(), coreHeight: Number(height), squeeks };
}

export function mergeReady(s, eco, height) {
  return s.level > 0 && s.level < eco.maximumLevel && s.nextMergeHeight <= height;
}

export function buildBoard(snapshot, eco) {
  const byOwner = new Map();
  for (const s of snapshot.squeeks) {
    if (s.owner === eco.staking || s.owner === eco.escrow) continue;
    let m = byOwner.get(s.owner);
    if (!m) byOwner.set(s.owner, (m = new Map()));
    const list = m.get(s.level) ?? [];
    list.push(s);
    m.set(s.level, list);
  }
  const singles = [];
  const levels = {};
  for (const [owner, m] of byOwner) {
    for (const [level, list] of m) {
      levels[level] ??= { holders: 0, squeeks: 0, singles: 0 };
      levels[level].holders++;
      levels[level].squeeks += list.length;
      if (list.length % 2 === 1 && level < eco.maximumLevel) {
        levels[level].singles++;
        const pick = [...list].sort((a, b) => a.nextMergeHeight - b.nextMergeHeight)[0];
        singles.push({
          owner,
          level,
          tokenId: pick.id,
          mergeReady: mergeReady(pick, eco, snapshot.coreHeight),
          nextMergeHeight: pick.nextMergeHeight,
        });
      }
    }
  }
  singles.sort((a, b) => a.level - b.level || a.tokenId - b.tokenId);
  return { at: snapshot.at, coreHeight: snapshot.coreHeight, levels, singles, holders: byOwner.size };
}

export function walletFromSnapshot(snapshot, address) {
  const a = address.toLowerCase();
  return snapshot.squeeks.filter((s) => s.owner === a);
}
