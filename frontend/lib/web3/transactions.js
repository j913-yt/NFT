import { ethers } from "ethers";

import {
  assertTokenOwner,
  createNFTContract,
  hasBuyEntryPoint,
  isMissingCallException,
  parseMintedTokenId,
  readListingCompat,
} from "./contracts";
import { normalizeRoyaltyBps, toEthWei } from "./pricing";
import { safeNumber, shortAddress } from "./utils";
import { getProviderAndSigner } from "./wallet";

function notifyStage(onStage, stage, txHash = "") {
  onStage?.(stage, txHash);
}

function resolveRoyaltyReceiver(account, royaltyReceiver, royaltyFeeBps) {
  if (royaltyFeeBps <= 0) {
    return ethers.ZeroAddress;
  }

  if (royaltyReceiver && ethers.isAddress(royaltyReceiver)) {
    return royaltyReceiver;
  }

  return account;
}

async function executeMint({
  contract,
  account,
  tokenURI,
  priceEth,
  royaltyFeeBps,
  royaltyReceiver,
}) {
  if (priceEth > 0) {
    const listedPriceWei = toEthWei(priceEth);
    try {
      return {
        tx: await contract["mintAndList(string,uint256,address,uint96)"](
          tokenURI,
          listedPriceWei,
          royaltyReceiver,
          royaltyFeeBps,
        ),
        listedPriceWei,
      };
    } catch (err) {
      if (royaltyFeeBps > 0 && isMissingCallException(err)) {
        throw new Error("当前合约不支持 EIP-2981 版税，请部署新版合约后再创建");
      }
      if (royaltyFeeBps > 0 || !isMissingCallException(err)) {
        throw err;
      }
      return {
        tx: await contract["mintAndList(string,uint256)"](tokenURI, listedPriceWei),
        listedPriceWei,
      };
    }
  }

  try {
    return {
      tx: await contract["safeMint(address,string,address,uint96)"](
        account,
        tokenURI,
        royaltyReceiver,
        royaltyFeeBps,
      ),
      listedPriceWei: 0n,
    };
  } catch (err) {
    if (royaltyFeeBps > 0 && isMissingCallException(err)) {
      throw new Error("当前合约不支持 EIP-2981 版税，请部署新版合约后再创建");
    }
    if (royaltyFeeBps > 0 || !isMissingCallException(err)) {
      throw err;
    }
    return {
      tx: await contract["safeMint(address,string)"](account, tokenURI),
      listedPriceWei: 0n,
    };
  }
}

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

async function assertListingOwner(contract, tokenId, seller) {
  const owner = await contract.ownerOf(tokenId);
  if (
    seller &&
    String(owner || "").trim().toLowerCase() !==
      String(seller || "").trim().toLowerCase()
  ) {
    throw new Error(
      `该 NFT 的链上持有人是 ${shortAddress(owner)}，与当前上架卖家 ${shortAddress(seller)} 不一致，请让卖家重新上架后再试`,
    );
  }
}

export async function mintNFTWithWallet({
  tokenURI,
  walletId,
  priceEth = 0,
  royaltyReceiver = "",
  royaltyFeeBps = 0,
  contractAddress = "",
  onStage,
}) {
  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = createNFTContract({ contractAddress, runner: signer });
  const normalizedPriceEth = safeNumber(priceEth);
  const normalizedRoyaltyBps = normalizeRoyaltyBps(royaltyFeeBps);
  const normalizedRoyaltyReceiver = resolveRoyaltyReceiver(
    account,
    royaltyReceiver,
    normalizedRoyaltyBps,
  );

  notifyStage(onStage, "wallet");
  const { tx, listedPriceWei } = await executeMint({
    contract,
    account,
    tokenURI,
    priceEth: normalizedPriceEth,
    royaltyFeeBps: normalizedRoyaltyBps,
    royaltyReceiver: normalizedRoyaltyReceiver,
  });
  notifyStage(onStage, "chain", tx.hash);

  const receipt = await tx.wait();
  notifyStage(onStage, "confirmed", receipt.hash);

  let tokenId = parseMintedTokenId(contract, receipt, account);
  if (!tokenId) {
    tokenId = (await contract.totalMinted()).toString();
  }

  await assertTokenOwner(contract, tokenId, account, "继续同步后台数据");

  return {
    account,
    txHash: receipt.hash,
    tokenId,
    listed: normalizedPriceEth > 0,
    listedPriceWei: listedPriceWei.toString(),
    listedPriceEth:
      normalizedPriceEth > 0 ? Number(ethers.formatEther(listedPriceWei)) : 0,
    royaltyFeeBps: normalizedRoyaltyBps,
    royaltyReceiver:
      normalizedRoyaltyBps > 0 ? normalizedRoyaltyReceiver.toLowerCase() : "",
  };
}

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
