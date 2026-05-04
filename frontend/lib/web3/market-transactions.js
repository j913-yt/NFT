// NFT 市场交易方法。
// 负责已铸造 NFT 的上架、下架和购买，并在交易前校验链上持有人和上架状态。
import { ethers } from "ethers";

import {
  assertTokenOwner,
  createNFTContract,
  hasBuyEntryPoint,
  readListingCompat,
} from "./contracts";
import { toEthWei } from "./pricing";
import { notifyStage } from "./transaction-progress";
import { safeNumber, shortAddress } from "./utils";
import { getProviderAndSigner } from "./wallet";

// 从后台保存的价格构造购买信息。正常情况下应读取链上 getListing；
// 这里主要用于旧合约读不到 listing 时，仍能用后台价格发起购买尝试。
function resolveFallbackListing(fallbackPriceWei, fallbackPriceEth) {
  const rawWei = String(fallbackPriceWei || "").trim();
  if (rawWei) {
    try {
      return {
        seller: "",
        priceWei: BigInt(rawWei),
        active: true,
        source: "fallback-price-wei",
      };
    } catch {
      throw new Error("后端返回的 priceWei 无效，无法发起购买");
    }
  }

  const fallbackEth = safeNumber(fallbackPriceEth);
  if (fallbackEth <= 0) {
    throw new Error("当前合约无法读取上架信息，且没有可用价格，无法发起购买");
  }

  return {
    seller: "",
    priceWei: toEthWei(fallbackEth),
    active: true,
    source: "fallback-price",
  };
}

// 购买前解析上架信息：优先读合约真实状态；读不到时检查合约是否至少有 buy 入口。
async function resolveBuyListing({
  contract,
  tokenId,
  account,
  fallbackPriceWei,
  fallbackPriceEth,
}) {
  const listing = await readListingCompat(contract, tokenId);
  if (listing) {
    return listing;
  }

  if (!(await hasBuyEntryPoint(contract, tokenId, account))) {
    throw new Error(
      "当前合约是旧版（仅支持铸造），不支持真实购买。请部署新版合约并更新 NEXT_PUBLIC_NFT_CONTRACT_ADDRESS",
    );
  }

  return resolveFallbackListing(fallbackPriceWei, fallbackPriceEth);
}

// 校验卖家是否仍然是 NFT 的链上 owner，避免页面缓存的上架信息已经过期。
async function assertListingOwner(contract, tokenId, seller) {
  const owner = await contract.ownerOf(tokenId);
  const normalizedSeller = String(seller || "").trim().toLowerCase();
  const normalizedOwner = String(owner || "").trim().toLowerCase();

  if (normalizedSeller && normalizedOwner !== normalizedSeller) {
    throw new Error(
      `该 NFT 的链上持有人是 ${shortAddress(owner)}，与当前上架卖家 ${shortAddress(seller)} 不一致，请让卖家重新上架后再试`,
    );
  }
}

// 已铸造 NFT 的上架入口：把页面输入的 ETH 价格换成 wei，然后调用合约 listToken(tokenId, priceWei)。
export async function listNFTWithWallet({
  tokenId,
  priceEth,
  walletId,
  contractAddress = "",
  onStage,
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法上架");
  }

  const normalizedPrice = safeNumber(priceEth);
  if (normalizedPrice <= 0) {
    throw new Error("上架价格必须大于 0");
  }

  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = createNFTContract({ contractAddress, runner: signer });
  await assertTokenOwner(contract, tokenId, account, "上架");

  // 合约不接收 ETH 小数，只接收 wei，所以所有价格写链前都要经过 toEthWei。
  const priceWei = toEthWei(normalizedPrice);
  notifyStage(onStage, "wallet");
  const tx = await contract.listToken(tokenId, priceWei);
  notifyStage(onStage, "chain", tx.hash);
  const receipt = await tx.wait();
  notifyStage(onStage, "confirmed", receipt.hash);

  return {
    account,
    txHash: receipt.hash,
    priceWei: priceWei.toString(),
    priceEth: Number(ethers.formatEther(priceWei)),
  };
}

// 下架入口：调用合约 cancelListing(tokenId)，只删除市场上架信息，不销毁 NFT。
export async function delistNFTWithWallet({
  tokenId,
  walletId,
  contractAddress = "",
  onStage,
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法下架");
  }

  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = createNFTContract({ contractAddress, runner: signer });
  await assertTokenOwner(contract, tokenId, account, "下架");

  notifyStage(onStage, "wallet");
  const tx = await contract.cancelListing(tokenId);
  notifyStage(onStage, "chain", tx.hash);
  const receipt = await tx.wait();
  notifyStage(onStage, "confirmed", receipt.hash);

  return {
    account,
    txHash: receipt.hash,
  };
}

// 购买入口：先读取链上 listing，再用 listing.priceWei 作为 msg.value 调用 buy(tokenId)。
export async function buyNFTWithWallet({
  tokenId,
  walletId,
  fallbackPriceWei = "",
  fallbackPriceEth = 0,
  contractAddress = "",
  onStage,
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法购买");
  }

  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = createNFTContract({ contractAddress, runner: signer });
  const listing = await resolveBuyListing({
    contract,
    tokenId,
    account,
    fallbackPriceWei,
    fallbackPriceEth,
  });

  if (!listing.active || listing.priceWei <= 0n) {
    throw new Error("该 NFT 当前未上架");
  }
  if (listing.seller && listing.seller.toLowerCase() === account.toLowerCase()) {
    throw new Error("不能购买自己发布的 NFT");
  }

  await assertListingOwner(contract, tokenId, listing.seller);
  notifyStage(onStage, "wallet");
  // value 是随交易一起支付的链原生代币金额，必须和合约里 listing.priceWei 完全一致。
  const tx = await contract.buy(tokenId, { value: listing.priceWei });
  notifyStage(onStage, "chain", tx.hash);
  const receipt = await tx.wait();
  notifyStage(onStage, "confirmed", receipt.hash);

  return {
    account,
    txHash: receipt.hash,
    priceWei: listing.priceWei.toString(),
    priceEth: Number(ethers.formatEther(listing.priceWei)),
    listingSource: listing.source,
  };
}
