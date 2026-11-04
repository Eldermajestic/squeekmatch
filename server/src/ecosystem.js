import { config } from "./config.js";
import { client, fetchApi, nftAbi, escrowViewAbi } from "./chain.js";

const lc = (a) => (a ? String(a).toLowerCase() : null);

export async function loadEcosystem() {
  const econ = await fetchApi("/v1/economy/state");
  if (econ.status !== "available") throw new Error(`economy unavailable: ${econ.reason}`);
  const id = econ.identities;
  const eco = {
    release: econ.release?.id,
    nft: config.override.nft || lc(id.genesis),
    sqk: config.override.sqk || lc(id.token ?? econ.asset?.address),
    core: lc(id.core),
    staking: lc(id.staking?.proxy ?? id.staking),
    mining: lc(id.mining?.proxy ?? id.mining),
    decimals: econ.asset?.decimals ?? 18,
    maximumLevel: Number(econ.nft?.maximumLevel ?? 10),
    cooldownBlocks: (econ.nft?.cooldownBlocks ?? []).map(Number),
    basePower: (econ.nft?.basePower ?? []).map(Number),
    mergesOpen: econ.nft?.mergesOpen !== false,
    escrow: config.escrow,
    checks: [],
    ok: true,
  };
  const check = (label, expected, actual) => {
    const ok = lc(expected) === lc(actual);
    eco.checks.push({ label, expected: lc(expected), actual: lc(actual), ok });
    if (!ok) eco.ok = false;
  };
  const core = await client.readContract({ address: eco.nft, abi: nftAbi, functionName: "sqkCore" });
  check("NFT core", eco.core, core);
  if (eco.escrow) {
    const [nft, sqk, maxLevel] = await Promise.all(
      ["SQUEEK", "SQK", "MAXIMUM_LEVEL"].map((functionName) =>
        client.readContract({ address: eco.escrow, abi: escrowViewAbi, functionName }),
      ),
    );
    check("Escrow NFT", eco.nft, nft);
    check("Escrow SQK", eco.sqk, sqk);
    if (Number(maxLevel) !== eco.maximumLevel) {
      eco.checks.push({ label: "Escrow max level", expected: String(eco.maximumLevel), actual: String(maxLevel), ok: false });
      eco.ok = false;
    }
  }
  eco.checkedAt = Date.now();
  return eco;
}
