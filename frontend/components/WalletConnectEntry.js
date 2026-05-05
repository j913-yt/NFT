"use client";

import WalletConnectButton from "@/components/WalletConnectButton";
import WalletProviders from "@/components/WalletProviders";

export default function WalletConnectEntry() {
  return (
    <WalletProviders>
      <WalletConnectButton />
    </WalletProviders>
  );
}
