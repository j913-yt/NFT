// NFT 合约辅助方法。
// 负责创建 ethers 合约对象、解析铸造事件、读取上架信息，以及做链上 owner 校验。
import { ethers } from "ethers";

import { NFT_CONTRACT_ABI, resolveContractAddress } from "./constants";
import { shortAddress } from "./utils";

// 旧版或实验版合约可能用不同函数名保存上架信息。
// 新版优先读 getListing；这些只作为读取兼容尝试，不改变交易逻辑。
const LISTING_COMPAT_VARIANTS = [
  {
    fn: "listings",
    abi: [
      "function listings(uint256 tokenId) view returns (address seller, uint256 priceWei, bool active)",
    ],
  },
  {
    fn: "tokenListings",
    abi: [
      "function tokenListings(uint256 tokenId) view returns (address seller, uint256 priceWei, bool active)",
    ],
  },
  {
    fn: "listingOf",
    abi: [
      "function listingOf(uint256 tokenId) view returns (address seller, uint256 priceWei, bool active)",
    ],
  },
  {
    fn: "orders",
    abi: [
      "function orders(uint256 tokenId) view returns (address seller, uint256 priceWei, bool active)",
    ],
  },
  {
    fn: "getOrder",
    abi: [
      "function getOrder(uint256 tokenId) view returns (address seller, uint256 priceWei, bool active)",
    ],
  },
];

// 解析 Minted/Transfer 事件时，用 expected 过滤目标接收地址，避免误读同一交易里的其它日志。
function matchesExpectedAddress(value, expected) {
  if (!expected) {
    return true;
  }

  return String(value || "").trim().toLowerCase() === expected;
}

// 从交易回执日志里查找新铸造的 tokenId。
// Minted 是本项目合约自定义事件；Transfer 是 ERC721 铸造时从零地址转出的标准事件。
function findMintedTokenId(contract, receipt, eventName, expectedTo) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name !== eventName) {
        continue;
      }

      if (!matchesExpectedAddress(parsed.args.to, expectedTo)) {
        continue;
      }

      if (
        eventName === "Transfer" &&
        String(parsed.args.from || "").trim().toLowerCase() !==
          ethers.ZeroAddress.toLowerCase()
      ) {
        continue;
      }

      return parsed.args.tokenId.toString();
    } catch {
      // 同一笔交易里可能有别的合约日志，解析失败说明不是 NFT 合约事件，继续看下一条。
    }
  }

  return "";
}

// 创建 ethers 合约对象：
// runner 是 provider 时只能读链；runner 是 signer 时可以发需要钱包签名的交易。
export function createNFTContract({ contractAddress = "", runner }) {
  return new ethers.Contract(
    resolveContractAddress(contractAddress),
    NFT_CONTRACT_ABI,
    runner,
  );
}

// 铸造交易确认后，从回执里解析 tokenId。优先读自定义 Minted，失败再读 ERC721 Transfer。
export function parseMintedTokenId(contract, receipt, expectedTo = "") {
  const normalizedExpected = String(expectedTo || "").trim().toLowerCase();
  return (
    findMintedTokenId(contract, receipt, "Minted", normalizedExpected) ||
    findMintedTokenId(contract, receipt, "Transfer", normalizedExpected)
  );
}

// 判断是否是“当前合约没有这个函数/读不到返回数据”的错误。
// 这类错误用于识别旧合约能力缺失，真实 revert 错误仍然继续抛出。
export function isMissingCallException(err) {
  return (
    err?.code === "CALL_EXCEPTION" &&
    (err?.data == null ||
      String(err?.shortMessage || "").includes("missing revert data"))
  );
}

// 读取链上上架信息。新版合约读 getListing；读不到时尝试几个历史命名。
// 返回的 priceWei 是 bigint，active 表示链上是否认为当前仍可购买。
export async function readListingCompat(contract, tokenId) {
  try {
    const [seller, priceWei, active] = await contract.getListing(tokenId);
    return { seller, priceWei, active: Boolean(active), source: "getListing" };
  } catch (err) {
    if (!isMissingCallException(err)) {
      throw err;
    }
  }

  for (const variant of LISTING_COMPAT_VARIANTS) {
    try {
      const compatContract = new ethers.Contract(
        resolveContractAddress(contract.target),
        variant.abi,
        contract.runner,
      );
      const [seller, priceWei, active] = await compatContract[variant.fn](tokenId);
      return { seller, priceWei, active: Boolean(active), source: variant.fn };
    } catch {
      // 当前命名不存在或读取失败时，继续尝试下一个历史命名。
    }
  }

  return null;
}

// 写链前校验当前钱包确实是 tokenId 的 owner。
// 上架/下架必须由 NFT 持有人操作，否则合约会失败；这里提前给出更清楚的提示。
export async function assertTokenOwner(contract, tokenId, account, actionLabel) {
  const owner = await contract.ownerOf(tokenId);
  const normalizedOwner = String(owner || "").trim().toLowerCase();
  const normalizedAccount = String(account || "").trim().toLowerCase();

  if (normalizedOwner && normalizedOwner !== normalizedAccount) {
    throw new Error(
      `当前钱包 ${shortAddress(account)} 不是该 NFT 的链上持有人，无法${actionLabel}。链上持有人为 ${shortAddress(owner)}`,
    );
  }

  return owner;
}

// 检查合约是否存在 buy(tokenId) 入口。
// provider.call 是只读模拟调用，不会真正付款；这里只用来区分旧合约是否支持购买方法。
export async function hasBuyEntryPoint(contract, tokenId, from) {
  const provider = contract.runner?.provider;
  if (!provider) {
    return true;
  }

  try {
    const data = contract.interface.encodeFunctionData("buy", [tokenId]);
    await provider.call({
      to: resolveContractAddress(contract.target),
      from,
      data,
      value: 0n,
    });
    return true;
  } catch (err) {
    return !isMissingCallException(err);
  }
}
