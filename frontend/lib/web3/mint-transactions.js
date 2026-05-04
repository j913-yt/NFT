// NFT 铸造交易方法。
// 负责根据是否填写价格选择 safeMint 或 mintAndList，并处理版税参数、交易确认和 tokenId 解析。
import { ethers } from "ethers";

import {
  assertTokenOwner,
  createNFTContract,
  isMissingCallException,
  parseMintedTokenId,
} from "./contracts";
import { normalizeRoyaltyBps, toEthWei } from "./pricing";
import { notifyStage } from "./transaction-progress";
import { safeNumber } from "./utils";
import { getProviderAndSigner } from "./wallet";

// 整理版税接收地址。用户没设置版税时传零地址；设置了版税但没填地址时，默认收款人为当前钱包。
function resolveRoyaltyReceiver(account, royaltyReceiver, royaltyFeeBps) {
  if (royaltyFeeBps <= 0) {
    return ethers.ZeroAddress;
  }

  if (royaltyReceiver && ethers.isAddress(royaltyReceiver)) {
    return royaltyReceiver;
  }

  return account;
}

// 创建时填了价格就调用 mintAndList，合约会“铸造 + 立即上架”。
async function executeMintAndList({
  contract,
  tokenURI,
  priceEth,
  royaltyFeeBps,
  royaltyReceiver,
}) {
  // 合约里的价格单位是 wei，页面输入的是 ETH，所以写链前必须先换算。
  const listedPriceWei = toEthWei(priceEth);

  try {
    return {
      // mintAndList 有函数重载，ethers 需要完整签名来区分 2 参数版和 4 参数版。
      tx: await contract["mintAndList(string,uint256,address,uint96)"](
        tokenURI,
        listedPriceWei,
        royaltyReceiver,
        royaltyFeeBps,
      ),
      listedPriceWei,
    };
  } catch (err) {
    // 旧合约可能没有版税版 mintAndList。只有未设置版税时才允许退回 2 参数版。
    if (royaltyFeeBps > 0 && isMissingCallException(err)) {
      throw new Error("当前合约不支持 EIP-2981 版税，请部署新版合约后再创建");
    }
    if (royaltyFeeBps > 0 || !isMissingCallException(err)) {
      throw err;
    }
    return {
      // 2 参数版等价于合约里传 address(0), 0，不会设置版税。
      tx: await contract["mintAndList(string,uint256)"](tokenURI, listedPriceWei),
      listedPriceWei,
    };
  }
}

// 创建时没有填写价格就调用 safeMint，合约只铸造 NFT，不创建上架信息。
async function executeSafeMint({ contract, account, tokenURI, royaltyFeeBps, royaltyReceiver }) {
  try {
    return {
      // NFT 会被安全铸造到当前连接的钱包 account。
      tx: await contract["safeMint(address,string,address,uint96)"](
        account,
        tokenURI,
        royaltyReceiver,
        royaltyFeeBps,
      ),
      listedPriceWei: 0n,
    };
  } catch (err) {
    // safeMint 也有 2 参数和 4 参数重载，处理原则和 mintAndList 一样。
    if (royaltyFeeBps > 0 && isMissingCallException(err)) {
      throw new Error("当前合约不支持 EIP-2981 版税，请部署新版合约后再创建");
    }
    if (royaltyFeeBps > 0 || !isMissingCallException(err)) {
      throw err;
    }
    return {
      // 旧合约的 2 参数 safeMint 只接收接收者地址和 tokenURI。
      tx: await contract["safeMint(address,string)"](account, tokenURI),
      listedPriceWei: 0n,
    };
  }
}

// 铸造 NFT 的核心分支：
// priceEth > 0 时调用 mintAndList；priceEth <= 0 时调用 safeMint。
async function executeMint(options) {
  if (options.priceEth > 0) {
    return executeMintAndList(options);
  }

  return executeSafeMint(options);
}

// 创建 NFT 的前端总入口：
// 页面传入 IPFS tokenURI、价格和版税信息；这里连接钱包、发交易、等确认、解析 tokenId。
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
  // executeMint 返回 ethers 的交易对象 tx；如果是 mintAndList，还会返回实际写入合约的 wei 价格。
  const { tx, listedPriceWei } = await executeMint({
    contract,
    account,
    tokenURI,
    priceEth: normalizedPriceEth,
    royaltyFeeBps: normalizedRoyaltyBps,
    royaltyReceiver: normalizedRoyaltyReceiver,
  });
  notifyStage(onStage, "chain", tx.hash);

  // 等待链上确认。没有 receipt 前，事件日志和 tokenId 都还不能可靠读取。
  const receipt = await tx.wait();
  notifyStage(onStage, "confirmed", receipt.hash);

  // 优先从 Minted / Transfer 事件解析 tokenId；解析不到时再读取 totalMinted。
  let tokenId = parseMintedTokenId(contract, receipt, account);
  if (!tokenId) {
    tokenId = (await contract.totalMinted()).toString();
  }

  // 最后确认当前钱包确实拥有这个 tokenId，再把结果交给后台保存。
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
