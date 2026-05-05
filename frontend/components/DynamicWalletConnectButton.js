"use client";

import dynamic from "next/dynamic";

function WalletButtonLoading() {
  return (
    <button
      type="button"
      disabled
      className="rounded-xl bg-[#24334f] px-3 py-1.5 text-xs font-semibold text-white opacity-70"
    >
      ...
    </button>
  );
}

const WalletConnectEntry = dynamic(
  () => import("@/components/WalletConnectEntry"),
  {
    ssr: false,
    loading: WalletButtonLoading,
  },
);

export default function DynamicWalletConnectButton() {
  return <WalletConnectEntry />;
}
