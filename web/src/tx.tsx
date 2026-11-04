import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { BaseError, ContractFunctionRevertedError, type Abi, type Address } from "viem";
import { EXPLORER, erc20Abi, nftAbi } from "./chain";

export type Step = { label: string; address: Address; abi: Abi; functionName: string; args: readonly unknown[] };
type Run = { title: string; steps: Step[]; current: number; hashes: string[]; error?: string; done?: boolean };

const plain: Record<string, string> = {
  OrderNotOpen: "This order is no longer open.",
  OrderExpired: "This order has expired.",
  SelfTrade: "You can't fill your own order.",
  MakerNoLongerOwns: "The seller no longer owns this Squeek.",
  StaleOrder: "This Squeek was already traded here; the old order can't fill.",
  EscrowNotApproved: "SqueekMatch isn't approved to move this Squeek yet.",
  LevelMismatch: "The Squeek's level changed since the order was made.",
  CooldownActive: "That Squeek is still cooling down from its last merge.",
  AtMaximumLevel: "That Squeek is already at the maximum level.",
  NoLivePosition: "That Squeek doesn't exist any more.",
  NotTokenOwner: "You don't own that Squeek.",
  InvalidLevel: "That level isn't valid here.",
  ZeroAmount: "Enter an amount above zero.",
  DurationTooLong: "Orders can last at most 30 days.",
  NotMakerAndNotExpired: "Only the maker can cancel before expiry.",
  WrongToken: "This swap wants a different Squeek.",
  SameToken: "A Squeek can't be swapped for itself.",
  BothSidesPaySqk: "Only one side of a swap can add SQK.",
  SafeERC20FailedOperation: "The SQK transfer failed (balance or approval).",
  BatchSize: "Pick between 1 and 20 orders.",
  ERC20InsufficientBalance: "Not enough SQK in this wallet.",
  ERC20InsufficientAllowance: "SQK approval is too low.",
};

export function explain(e: unknown): string {
  if (e instanceof BaseError) {
    const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = reverted?.data?.errorName;
    if (name) return plain[name] ?? `The contract refused this (${name}).`;
    if (/User rejected|denied/i.test(e.message)) return "You cancelled the request in your wallet.";
    return e.shortMessage || e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

const Ctx = createContext<{ run: (title: string, steps: Step[], onDone?: () => void) => void } | null>(null);
export const useTx = () => useContext(Ctx)!;

export function TxProvider({ children }: { children: ReactNode }) {
  const { address, chainId } = useAccount();
  const pub = usePublicClient({ chainId: sepolia.id });
  const { data: wallet } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [state, setState] = useState<Run | null>(null);

  const run = useCallback(
    async (title: string, steps: Step[], onDone?: () => void) => {
      if (!address || !wallet || !pub) return setState({ title, steps, current: 0, hashes: [], error: "Connect a wallet first." });
      setState({ title, steps, current: 0, hashes: [] });
      try {
        if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });
        const hashes: string[] = [];
        for (let i = 0; i < steps.length; i++) {
          setState((s) => s && { ...s, current: i });
          const s = steps[i];
          const { request } = await pub.simulateContract({ account: address, address: s.address, abi: s.abi, functionName: s.functionName, args: s.args });
          const hash = await wallet.writeContract(request as never);
          hashes.push(hash);
          setState((x) => x && { ...x, hashes: [...hashes] });
          const r = await pub.waitForTransactionReceipt({ hash });
          if (r.status !== "success") throw new Error("The transaction reverted.");
        }
        setState((x) => x && { ...x, current: steps.length, done: true });
        onDone?.();
      } catch (e) {
        setState((x) => x && { ...x, error: explain(e) });
      }
    },
    [address, wallet, pub, chainId, switchChainAsync],
  );

  return (
    <Ctx.Provider value={{ run }}>
      {children}
      {state && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={state.title}>
          <div className="modal-content surface stack">
            <h2>{state.title}</h2>
            <ol className="tx-steps">
              {state.steps.map((s, i) => (
                <li key={i} className={i < state.current || state.done ? "done" : i === state.current ? "active" : ""}>
                  <span>{s.label}</span>
                  {state.hashes[i] && (
                    <a href={`${EXPLORER}/tx/${state.hashes[i]}`} target="_blank" rel="noreferrer">
                      view
                    </a>
                  )}
                </li>
              ))}
            </ol>
            <p className="simulation-note muted">Each step is dry-run first; your wallet only opens if it would succeed.</p>
            {state.error && <p className="notice error">{state.error}</p>}
            {state.done && <p className="notice success">Done.</p>}
            <button onClick={() => setState(null)}>{state.done || state.error ? "Close" : "Hide"}</button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useApprovals() {
  const { address } = useAccount();
  const pub = usePublicClient({ chainId: sepolia.id });
  return {
    async sqk(token: Address, spender: Address, amount: bigint): Promise<Step[]> {
      if (!address || !pub || amount === 0n) return [];
      const allowance = await pub.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [address, spender] });
      return allowance >= amount
        ? []
        : [{ label: "Approve SQK", address: token, abi: erc20Abi as Abi, functionName: "approve", args: [spender, amount] }];
    },
    async nft(nft: Address, operator: Address): Promise<Step[]> {
      if (!address || !pub) return [];
      const ok = await pub.readContract({ address: nft, abi: nftAbi, functionName: "isApprovedForAll", args: [address, operator] });
      return ok
        ? []
        : [{ label: "Allow SqueekMatch to move your Squeeks at fill", address: nft, abi: nftAbi as Abi, functionName: "setApprovalForAll", args: [operator, true] }];
    },
  };
}
