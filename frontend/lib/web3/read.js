// 链上只读查询方法。
// 负责读取 NFT 持有人、版税信息和上架状态，尽量不发起需要钱包确认的交易。
import { ethers } from "ethers";

import { BASIS_POINTS, ONE_ETH_WEI } from "./constants";
import { createNFTContract, readListingCompat } from "./contracts";
import { toEthWei } from "./pricing";
import { safeNumber } from "./utils";
import { getProviderAndSigner } from "./wallet";

// 只读 provider 用来查询链上状态，不需要钱包签名。
// 优先使用配置的 RPC；没有 RPC 时，浏览器钱包也可以提供一个只读连接。
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

// 解析用于计算版税的成交价。优先使用后端保存的 wei；没有 wei 时使用 ETH；都没有时按 1 ETH 估算。
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

// 读取版税信息。新版合约用 getRoyaltyInfo，会直接返回 feeBps；
// 如果合约只有标准 EIP-2981 royaltyInfo，就用 royaltyAmount / saleWei 反推出 feeBps。
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

// 查询某个 tokenId 当前链上 owner。失败时返回空字符串，页面可继续显示后台缓存数据。
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

// 查询某个 NFT 在指定成交价下的版税信息，详情页展示“版税金额/卖家预计收入”会用到。
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
  // saleWei 是传给合约 royaltyInfo/getRoyaltyInfo 的成交价，必须是 wei。
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

// 读取链上真实上架状态。这里需要钱包连接，是因为当前系统复用了 signer 作为合约 runner。
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
