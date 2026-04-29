import { getWalletNonce, walletLogin } from "@/lib/api";

const NONCE_TIMEOUT_MS = 10_000;
const LOGIN_TIMEOUT_MS = 10_000;
const SIGN_TIMEOUT_MS = 60_000;
const LOGIN_CANCELLED_MESSAGE = "钱包登录已取消";

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function buildLoginMessage(nonce) {
  return `NovaNFT Login\nnonce: ${nonce}`;
}

function assertLoginActive(shouldContinue) {
  if (!shouldContinue()) {
    throw new Error(LOGIN_CANCELLED_MESSAGE);
  }
}

export async function loginWithWallet({
  address,
  shouldContinue = () => true,
  signMessageAsync,
  setStage,
}) {
  if (!address) {
    throw new Error("钱包未返回可用账号，请重新连接");
  }

  setStage("nonce");
  const { nonce } = await withTimeout(
    getWalletNonce(address),
    NONCE_TIMEOUT_MS,
    "获取 nonce 超时，请确认后端已启动",
  );
  assertLoginActive(shouldContinue);

  setStage("sign");
  const signature = await withTimeout(
    signMessageAsync({ message: buildLoginMessage(nonce) }),
    SIGN_TIMEOUT_MS,
    "签名超时，请在钱包中确认",
  );
  assertLoginActive(shouldContinue);

  setStage("login");
  const data = await withTimeout(
    walletLogin(address, signature),
    LOGIN_TIMEOUT_MS,
    "登录超时，请重试",
  );
  assertLoginActive(shouldContinue);
  return data;
}

export function getWalletActionError(error, fallback) {
  const message = error?.message || fallback || "钱包操作失败";
  if (error?.code === 4001 || message.toLowerCase().includes("rejected")) {
    return "已取消钱包操作";
  }
  return message;
}

export function isWalletLoginCancelled(error) {
  return error?.message === LOGIN_CANCELLED_MESSAGE;
}
