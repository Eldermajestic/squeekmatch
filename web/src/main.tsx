import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/dm-sans";
import "./styles.css";
import "./app.css";
import { wagmiConfig } from "./chain";
import { TxProvider } from "./tx";
import App from "./App";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TxProvider>
          <App />
        </TxProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
