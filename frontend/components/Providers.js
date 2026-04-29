"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { NextUIProvider } from "@nextui-org/react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { APP_CHAIN, wagmiConfig } from "@/lib/wallet/config";

export default function Providers({ children }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <NextUIProvider navigate={router.push}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider initialChain={APP_CHAIN} showRecentTransactions>
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NextUIProvider>
  );
}
