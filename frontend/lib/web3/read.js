import { ethers } from "ethers";

import { BASIS_POINTS, ONE_ETH_WEI } from "./constants";
import { createNFTContract, readListingCompat } from "./contracts";
import { toEthWei } from "./pricing";
import { safeNumber } from "./utils";
import { getProviderAndSigner } from "./wallet";

function getReadOnlyProvider() {
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "";
  if (rpcUrl) {
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }

  throw new Error("无法读取链上版税信息：请配置 NEXT_PUBLIC_RPC_URL");
}

function resolveSaleWei(salePriceWei, salePriceEth) {
  const rawWei = String(salePriceWei || "").trim();
  if (rawWei) {
    try {
      return BigInt(rawWei);
    } catch {
      return 0n;
    }
  }

  const saleEth = safeNumber(salePriceEth);
  if (saleEth > 0) {
    return toEthWei(saleEth);
  }

  return ONE_ETH_WEI;
}

async function readRoyaltyCompat(contract, tokenId, saleWei) {
  try {
    const [receiver, royaltyAmount, feeBps] = await contract.getRoyaltyInfo(
      tokenId,
      saleWei,
    );
    return { receiver, royaltyAmount, feeBps: Number(feeBps) };
  } catch {
    const [receiver, royaltyAmount] = await contract.royaltyInfo(tokenId, saleWei);
    const feeBps =
      saleWei > 0n ? Number((royaltyAmount * BASIS_POINTS) / saleWei) : 0;
    return { receiver, royaltyAmount, feeBps };
  }
}

export async function getTokenOwnerOnChain(tokenId, contractAddress = "") {
  if (!tokenId) {
    return "";
  }

  try {
    const provider = getReadOnlyProvider();
    const contract = createNFTContract({ contractAddress, runner: provider });
    return await contract.ownerOf(tokenId);
  } catch {
    return "";
  }
}

export async function getRoyaltyInfoOnChain({
  tokenId,
  salePriceWei = "",
  salePriceEth = 0,
  contractAddress = "",
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法查询版税");
  }

  const provider = getReadOnlyProvider();
  const contract = createNFTContract({ contractAddress, runner: provider });
  const saleWei = resolveSaleWei(salePriceWei, salePriceEth);
  const { receiver, royaltyAmount, feeBps } = await readRoyaltyCompat(
    contract,
    tokenId,
    saleWei,
  );

  const saleEthValue = Number(ethers.formatEther(saleWei));
  const royaltyEthValue = Number(ethers.formatEther(royaltyAmount));
  return {
    receiver,
    royaltyWei: royaltyAmount.toString(),
    royaltyEth: royaltyEthValue,
    feeBps,
    salePriceWei: saleWei.toString(),
    salePriceEth: saleEthValue,
    sellerReceiveEth: Math.max(saleEthValue - royaltyEthValue, 0),
  };
}

export async function getOnChainListing(tokenId, walletId, contractAddress = "") {
  const { signer } = await getProviderAndSigner(walletId);
  const contract = createNFTContract({ contractAddress, runner: signer });
  const listing = await readListingCompat(contract, tokenId);
  if (!listing) {
    throw new Error("当前合约不支持读取上架信息，请更新为新版合约地址后再试");
  }

  return {
    seller: listing.seller,
    priceWei: listing.priceWei.toString(),
    priceEth: Number(ethers.formatEther(listing.priceWei)),
    active: Boolean(listing.active),
    source: listing.source,
  };
}
