import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { sepolia } from "wagmi/chains";

export const APP_CHAIN = sepolia;

function requireWalletConnectProjectId() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("缺少 NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID，无法启用 WalletConnect");
  }
  return projectId;
}

export const wagmiConfig = getDefaultConfig({
  appName: "Nova NFT Market",
  appDescription: "支持钱包登录、IPFS 铸造与链上交易的 NFT 数字藏品平台",
  projectId: requireWalletConnectProjectId(),
  chains: [APP_CHAIN],
  wallets: [
    {
      groupName: "推荐钱包",
      wallets: [injectedWallet, walletConnectWallet, coinbaseWallet],
    },
  ],
  ssr: true,
});
