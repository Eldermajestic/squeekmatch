import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const useConfig = () => useQuery({ queryKey: ["config"], queryFn: api.config, refetchInterval: 60_000 });
export const useBoard = () => useQuery({ queryKey: ["board"], queryFn: api.board, refetchInterval: 60_000 });
export const useOrders = () => useQuery({ queryKey: ["orders"], queryFn: () => api.orders("open"), refetchInterval: 20_000 });
export const useMarket = () => useQuery({ queryKey: ["market"], queryFn: api.market, refetchInterval: 30_000 });
export const useWallet = (address?: string | null) =>
  useQuery({ queryKey: ["wallet", address?.toLowerCase()], queryFn: () => api.wallet(address!), enabled: !!address, refetchInterval: 30_000 });

export function useRefresh() {
  const qc = useQueryClient();
  return () => {
    setTimeout(() => qc.invalidateQueries(), 4000);
    qc.invalidateQueries();
  };
}
