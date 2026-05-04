// 前端价格和版税换算工具。
// 负责把页面输入的 ETH/WEI/GWEI/法币等单位整理成合约需要的 ETH 或 wei。
import { ethers } from "ethers";

import {
  DEFAULT_BNB_TO_ETH,
  DEFAULT_ETH_PRICE_USD,
  DEFAULT_MATIC_TO_ETH,
  DEFAULT_USD_TO_CNY,
  MAX_ROYALTY_BPS,
} from "./constants";
import { safeNumber, toSafeInt } from "./utils";

// 页面允许用环境变量覆盖展示汇率；如果没配置或配置成无效值，下方会回到默认值。
const ETH_PRICE_USD = Number(
  process.env.NEXT_PUBLIC_ETH_PRICE_USD || DEFAULT_ETH_PRICE_USD,
);
const USD_TO_CNY = Number(
  process.env.NEXT_PUBLIC_USD_TO_CNY || DEFAULT_USD_TO_CNY,
);
const BNB_TO_ETH = Number(
  process.env.NEXT_PUBLIC_BNB_TO_ETH || DEFAULT_BNB_TO_ETH,
);
const MATIC_TO_ETH = Number(
  process.env.NEXT_PUBLIC_MATIC_TO_ETH || DEFAULT_MATIC_TO_ETH,
);

// 读取 ETH/USD 展示汇率。这里只影响前端换算，不会影响链上成交价格。
function resolveEthUsdRate() {
  return ETH_PRICE_USD > 0 ? ETH_PRICE_USD : DEFAULT_ETH_PRICE_USD;
}

function resolveUsdCnyRate() {
  return USD_TO_CNY > 0 ? USD_TO_CNY : DEFAULT_USD_TO_CNY;
}

// 把页面输入的版税值整理成合约需要的基点数。
// 例如 500 表示 5%；超过上限时按 MAX_ROYALTY_BPS 截断。
export function normalizeRoyaltyBps(value) {
  const normalized = toSafeInt(value);
  if (normalized <= 0) {
    return 0;
  }

  return Math.min(normalized, MAX_ROYALTY_BPS);
}

// 把用户选择的计价单位统一换算成 ETH。
// 合约最终只接收 wei，这一步是页面输入层到链上单位之间的中间换算。
export function convertPriceToEth(value, unit = "ETH") {
  const amount = safeNumber(value);
  if (amount <= 0) {
    return 0;
  }

  const normalizedUnit = String(unit || "ETH").trim().toUpperCase();
  if (normalizedUnit === "ETH") return amount;
  if (normalizedUnit === "WEI") return amount / 1e18;
  if (normalizedUnit === "GWEI") return amount / 1e9;
  if (normalizedUnit === "BNB") return amount * BNB_TO_ETH;
  if (normalizedUnit === "MATIC") return amount * MATIC_TO_ETH;

  if (normalizedUnit === "USD" || normalizedUnit === "USDT") {
    return amount / resolveEthUsdRate();
  }

  if (normalizedUnit === "USDC") {
    return amount / resolveEthUsdRate();
  }

  if (normalizedUnit === "CNY") {
    return amount / (resolveEthUsdRate() * resolveUsdCnyRate());
  }

  return amount;
}

// 用于页面展示 ETH 数量，去掉多余的尾随 0。
export function formatEth(value, fractionDigits = 8) {
  const normalized = safeNumber(value);
  if (normalized <= 0) {
    return "0";
  }

  return normalized.toFixed(fractionDigits).replace(/\.?0+$/, "");
}

// ethers.parseEther 需要十进制字符串；这里把数字整理成最多 18 位小数的 ETH 字符串。
function toEthAmountString(value) {
  const normalized = safeNumber(value);
  if (normalized <= 0) {
    return "0";
  }

  return normalized.toFixed(18).replace(/\.?0+$/, "") || "0";
}

// 把 ETH 数量转换成 wei bigint。所有写入合约的价格都必须走这里。
export function toEthWei(value) {
  const asEth = toEthAmountString(value);
  const wei = ethers.parseEther(asEth);
  if (wei <= 0n) {
    throw new Error("价格换算后过小，请提高价格");
  }

  return wei;
}
