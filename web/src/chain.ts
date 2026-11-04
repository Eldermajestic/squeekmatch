import { createConfig, http, fallback } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors/injected";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import { parseAbi, type Abi } from "viem";
import escrowJson from "../../shared/escrow-abi.json";

export const escrowAbi = escrowJson as Abi;

export const nftAbi = parseAbi([
  "function ownerOf(uint256) view returns (address)",
  "function level(uint256) view returns (uint8)",
  "function nextMergeHeight(uint256) view returns (uint256)",
  "function isApprovedForAll(address,address) view returns (bool)",
  "function setApprovalForAll(address,bool)",
  "function merge(uint256 survivor, uint256 donor)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

export const stakingAbi = parseAbi(["function mergeDeposited(address nft, uint256 survivor, uint256 donor)"]);

export const RPCS = ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org"];

export const wagmiConfig = createConfig({
  chains: [sepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: "SqueekMatch", preference: { options: "all" } })],
  transports: { [sepolia.id]: fallback(RPCS.map((u) => http(u, { timeout: 10_000 }))) },
});

export const EXPLORER = "https://sepolia.etherscan.io";
