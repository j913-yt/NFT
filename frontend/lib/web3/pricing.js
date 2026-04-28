import { ethers } from "ethers";

import {
  DEFAULT_BNB_TO_ETH,
  DEFAULT_ETH_PRICE_USD,
  DEFAULT_MATIC_TO_ETH,
  DEFAULT_USD_TO_CNY,
  MAX_ROYALTY_BPS,
} from "./constants";
import { safeNumber, toSafeInt } from "./utils";

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

function resolveEthUsdRate() {
  return ETH_PRICE_USD > 0 ? ETH_PRICE_USD : DEFAULT_ETH_PRICE_USD;
}

function resolveUsdCnyRate() {
  return USD_TO_CNY > 0 ? USD_TO_CNY : DEFAULT_USD_TO_CNY;
}

export function normalizeRoyaltyBps(value) {
  const normalized = toSafeInt(value);
  if (normalized <= 0) {
    return 0;
  }

  return Math.min(normalized, MAX_ROYALTY_BPS);
}

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

export function formatEth(value, fractionDigits = 8) {
  const normalized = safeNumber(value);
  if (normalized <= 0) {
    return "0";
  }

  return normalized.toFixed(fractionDigits).replace(/\.?0+$/, "");
}

function toEthAmountString(value) {
  const normalized = safeNumber(value);
  if (normalized <= 0) {
    return "0";
  }

  return normalized.toFixed(18).replace(/\.?0+$/, "") || "0";
}

export function toEthWei(value) {
  const asEth = toEthAmountString(value);
  const wei = ethers.parseEther(asEth);
  if (wei <= 0n) {
    throw new Error("价格换算后过小，请提高价格");
  }

  return wei;
}
