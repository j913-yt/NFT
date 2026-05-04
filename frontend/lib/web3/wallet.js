// 钱包连接和签名对象获取。
// 负责检测浏览器钱包、校验登录钱包、返回 provider、signer 和当前账号地址。
import { ethers } from "ethers";
import { getAccount, getConnectorClient } from "@wagmi/core";

import { PREFERRED_WALLET_ID_KEY } from "./constants";
import { shortAddress } from "./utils";
import { wagmiConfig } from "@/lib/wallet/config";

const WAGMI_WALLET_ID = "wagmi";

// 记录用户上次选择的钱包插件，下次发起交易时优先使用同一个钱包。
export function getPreferredWalletId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PREFERRED_WALLET_ID_KEY) || "";
}

// 保存或清除用户偏好的钱包 ID，比如 metamask、okx、bitget。
export function setPreferredWalletId(walletId) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = String(walletId || "").trim();
  if (!normalized) {
    window.localStorage.removeItem(PREFERRED_WALLET_ID_KEY);
    return;
  }

  window.localStorage.setItem(PREFERRED_WALLET_ID_KEY, normalized);
}

// 从登录态里读取绑定的钱包地址，用来防止“登录账号”和“实际签名钱包”不一致。
function readLoggedInWallet() {
  if (typeof window === "undefined") {
    return "";
  }

  const rawUser = window.localStorage.getItem("current_user");
  if (!rawUser) {
    return "";
  }

  try {
    const user = JSON.parse(rawUser);
    return String(user?.wallet || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

// 链上交易必须由当前登录钱包签名，否则后台账号和链上资产会对不上。
function assertLoggedInWallet(account, actionLabel = "当前操作") {
  const expectedWallet = readLoggedInWallet();
  if (!expectedWallet) {
    return;
  }

  const actualWallet = String(account || "").trim().toLowerCase();
  if (!actualWallet || actualWallet === expectedWallet) {
    return;
  }

  throw new Error(
    `${actionLabel}使用的钱包 ${shortAddress(account)} 与当前登录钱包 ${shortAddress(expectedWallet)} 不一致，请切换到登录钱包后重试`,
  );
}

// wagmi 的 chain 对象转换成 ethers BrowserProvider 能识别的网络对象。
function buildEthersNetwork(chain) {
  if (!chain?.id) {
    return undefined;
  }

  return {
    chainId: chain.id,
    name: chain.name || "connected-chain",
  };
}

// 优先使用 RainbowKit/wagmi 当前已连接的钱包。
// signer 是能发交易和签名的对象；provider 主要负责读链和广播交易。
async function getConnectedWagmiWallet() {
  const activeAccount = getAccount(wagmiConfig);
  if (!activeAccount?.isConnected || !activeAccount.address) {
    return null;
  }

  const client = await getConnectorClient(wagmiConfig, {
    account: activeAccount.address,
  });
  const account = String(client.account?.address || activeAccount.address).trim();
  assertLoggedInWallet(account, "链上交易");

  const provider = new ethers.BrowserProvider(
    client.transport,
    buildEthersNetwork(client.chain),
  );
  const walletId = activeAccount.connector?.id || WAGMI_WALLET_ID;
  setPreferredWalletId(walletId);

  return {
    provider,
    signer: await provider.getSigner(account),
    account,
    walletId,
  };
}

// 多钱包环境下选择目标钱包：优先用用户指定或上次选择的钱包，否则用第一个检测到的钱包。
function resolveTargetWallet(wallets, preferredId) {
  const fallback = wallets[0];
  const normalizedPreferredId =
    String(preferredId || getPreferredWalletId() || "").trim() || "";
  if (!normalizedPreferredId) {
    return fallback;
  }

  return wallets.find((wallet) => wallet.id === normalizedPreferredId) || fallback;
}

// 检测浏览器注入的钱包对象。不同钱包会挂在 window.ethereum.providers 或自己的全局对象上。
export function detectInjectedWallets() {
  if (typeof window === "undefined") {
    return [];
  }

  const results = [];
  const ethereum = window.ethereum;
  const providers = ethereum?.providers || (ethereum ? [ethereum] : []);

  const pushWallet = (provider, id, name) => {
    if (!provider) return;
    if (results.find((wallet) => wallet.provider === provider)) return;
    results.push({ id, name, provider });
  };

  for (const provider of providers) {
    if (provider.isOkxWallet || provider.isOKExWallet) {
      pushWallet(provider, "okx", "OKX 钱包");
      continue;
    }

    if (provider.isBitKeep || provider.isBitgetWallet) {
      pushWallet(provider, "bitget", "Bitget 钱包");
      continue;
    }

    if (provider.isMetaMask) {
      pushWallet(provider, "metamask", "MetaMask 钱包");
    }
  }

  const okx = window.okxwallet?.ethereum || window.okxwallet;
  if (okx && !results.find((wallet) => wallet.id === "okx")) {
    pushWallet(okx, "okx", "OKX 钱包");
  }

  const bitget = window.bitkeep?.ethereum || window.bitkeep;
  if (bitget && !results.find((wallet) => wallet.id === "bitget")) {
    pushWallet(bitget, "bitget", "Bitget 钱包");
  }

  if (!results.length && ethereum) {
    pushWallet(ethereum, "injected", "浏览器默认钱包");
  }

  return results;
}

// 获取本次链上操作需要的 provider、signer 和 account。
// 页面调用合约写方法前都要先走这里，让用户授权并拿到可签名的钱包账户。
export async function getProviderAndSigner(preferredId) {
  if (typeof window === "undefined") {
    throw new Error("仅在浏览器中可用");
  }

  const wagmiWallet = await getConnectedWagmiWallet();
  if (wagmiWallet) {
    return wagmiWallet;
  }

  const wallets = detectInjectedWallets();
  if (!wallets.length) {
    throw new Error("未检测到钱包，请先安装 MetaMask / OKX / Bitget 等扩展");
  }

  const targetWallet = resolveTargetWallet(wallets, preferredId);
  const provider = new ethers.BrowserProvider(targetWallet.provider);
  const accounts = await provider.send("eth_requestAccounts", []);
  if (!Array.isArray(accounts) || !accounts[0]) {
    throw new Error("钱包未返回可用账号，请先在钱包中授权");
  }

  const expectedWallet = readLoggedInWallet();
  const matchedAccount = expectedWallet
    ? accounts.find(
        (account) => String(account || "").trim().toLowerCase() === expectedWallet,
      )
    : "";
  const account = String(matchedAccount || accounts[0]).trim();

  assertLoggedInWallet(account, "链上交易");
  setPreferredWalletId(targetWallet.id);

  return {
    provider,
    signer: await provider.getSigner(account),
    account,
    walletId: targetWallet.id,
  };
}
