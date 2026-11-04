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
  try {
    const st = await fetchApi("/v1/settlements?range=7d");
    const blocks = Number(st.summary?.completedBlockCount ?? 0);
    eco.blocksPerDay = blocks > 0 ? blocks / 7 : null;
    const minted = Number(BigInt(st.mining?.rangeMintedBaseUnits ?? 0) / 10n ** 12n) / 1e6;
    const stakingFunded = Number(BigInt(econ.mining?.stakingFundedBaseUnits ?? 0) / 10n ** 12n);
    const allFunded = stakingFunded + Number(BigInt(econ.mining?.gachaFundedBaseUnits ?? 0) / 10n ** 12n);
    const power = Number((BigInt(econ.staking?.totalNftPower ?? 0) + BigInt(econ.staking?.totalSqkPower ?? 0)) / 10n ** 15n) / 1e3;
    eco.sqkPerPowerPerDay = allFunded > 0 && power > 0 ? (minted * (stakingFunded / allFunded)) / 7 / power : null;
  } catch {
    eco.blocksPerDay ??= null;
    eco.sqkPerPowerPerDay ??= null;
  }
  eco.checkedAt = Date.now();
  return eco;
}
