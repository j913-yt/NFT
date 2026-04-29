"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import WalletAccountMenu from "@/components/wallet/WalletAccountMenu";
import WalletStatusModal from "@/components/wallet/WalletStatusModal";
import useWalletAccountGuard from "@/components/wallet/useWalletAccountGuard";
import useWalletLoginFlow from "@/components/wallet/useWalletLoginFlow";
import useWalletSessionState from "@/components/wallet/useWalletSessionState";
import { getWalletActionError } from "@/lib/wallet/login";
import { shortWalletAddress } from "@/lib/wallet/session";

function WalletConnectButtonView({
  loginFlow,
  onLogout,
  sessionState,
  shortAddress,
  walletLabel,
}) {
  const { session, setShowAccountMenu } = sessionState;
  return (
    <>
      <button
        type="button"
        onClick={loginFlow.handlePrimaryClick}
        disabled={loginFlow.loading}
        className={`rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition ${
          session.loggedIn ? "bg-[#2c4fa7] hover:bg-[#375fbf]" : "bg-[#4b86ff] hover:bg-[#5a95ff]"
        }`}
      >
        {loginFlow.loading ? "处理中..." : session.loggedIn ? shortAddress : "连接钱包"}
      </button>
      {loginFlow.stage && (
        <WalletStatusModal stage={loginFlow.stage} onCancel={loginFlow.cancelLogin} />
      )}
      {session.loggedIn && sessionState.showAccountMenu && (
        <WalletAccountMenu
          account={session.account}
          copied={sessionState.copied}
          onClose={() => setShowAccountMenu(false)}
          onCopy={sessionState.copyAccount}
          onLogout={onLogout}
          onProfile={sessionState.openProfile}
          shortAddress={shortAddress}
          walletLabel={walletLabel}
        />
      )}
    </>
  );
}

function buildLoginFlowInput({
  address,
  connector,
  isConnected,
  openConnectModal,
  router,
  sessionState,
  signMessageAsync,
}) {
  return {
    address,
    connectorId: connector?.id || "",
    isConnected,
    openConnectModal,
    router,
    session: sessionState.session,
    setSession: sessionState.setSession,
    setShowAccountMenu: sessionState.setShowAccountMenu,
    signMessageAsync,
  };
}

export default function WalletConnectButton() {
  const router = useRouter();
  const { address, connector, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const sessionState = useWalletSessionState({ router });
  const loginFlow = useWalletLoginFlow(buildLoginFlowInput({
    address,
    connector,
    isConnected,
    openConnectModal,
    router,
    sessionState,
    signMessageAsync,
  }));

  useWalletAccountGuard({
    address,
    clearLocalLogin: sessionState.clearLocalLogin,
    session: sessionState.session,
  });

  const handleLogout = async () => {
    try {
      if (isConnected) await disconnectAsync();
      sessionState.clearLocalLogin(true);
    } catch (error) {
      alert(getWalletActionError(error, "断开钱包失败"));
    }
  };

  return (
    <WalletConnectButtonView
      loginFlow={loginFlow}
      onLogout={handleLogout}
      sessionState={sessionState}
      shortAddress={shortWalletAddress(sessionState.session.account || address)}
      walletLabel={connector?.name || "已连接钱包"}
    />
  );
}
