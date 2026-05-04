// NFT 合约交互常量。
// 包含合约地址、前端使用的 ABI 片段、版税上限、价格单位常量和合约地址校验方法。
import { ethers } from "ethers";

// 前端默认使用的 NFT 合约地址。部署新合约后，需要在 frontend/.env.local 配置这个变量。
export const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0xYourDeployedContractAddress";

// 2500 基点 = 25%，需要和 Solidity 合约里的 MAX_ROYALTY_BPS 保持一致。
export const MAX_ROYALTY_BPS = 2500;
export const PREFERRED_WALLET_ID_KEY = "preferred_wallet_id";

// 版税按基点计算：10000 基点 = 100%；1 ETH = 10^18 wei。
export const BASIS_POINTS = 10_000n;
export const ONE_ETH_WEI = 10n ** 18n;

// 这些默认汇率只用于前端价格展示/输入换算，不是链上价格预言机。
export const DEFAULT_ETH_PRICE_USD = 3000;
export const DEFAULT_USD_TO_CNY = 7.2;
export const DEFAULT_BNB_TO_ETH = 0.12;
export const DEFAULT_MATIC_TO_ETH = 0.0002;

// 这里不是完整 ABI，而是前端会调用或解析的合约片段。
// 函数签名必须和 Solidity 完全一致；有重载时，ethers 会用完整签名区分具体方法。
export const NFT_CONTRACT_ABI = [
  // ERC721 基础读取：确认某个 tokenId 当前归谁所有。
  "function ownerOf(uint256 tokenId) external view returns (address)",

  // 铸造入口：2 参数版不设置版税，4 参数版可以设置 EIP-2981 版税。
  "function safeMint(address to, string uri) external returns (uint256)",
  "function safeMint(address to, string uri, address royaltyReceiver, uint96 royaltyFeeBps) external returns (uint256)",

  // 铸造并上架入口：priceWei 是链上价格，单位是 wei，不是 ETH 小数。
  "function mintAndList(string uri, uint256 priceWei) external returns (uint256)",
  "function mintAndList(string uri, uint256 priceWei, address royaltyReceiver, uint96 royaltyFeeBps) external returns (uint256)",

  // 市场操作入口：上架、下架、购买。
  "function totalMinted() external view returns (uint256)",
  "function listToken(uint256 tokenId, uint256 priceWei) external",
  "function cancelListing(uint256 tokenId) external",
  "function buy(uint256 tokenId) external payable",

  // 市场和版税读取入口：详情页、购买前校验、版税展示会用到。
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 priceWei, bool active)",
  "function getRoyaltyInfo(uint256 tokenId, uint256 salePriceWei) external view returns (address receiver, uint256 royaltyAmount, uint96 royaltyFeeBps)",
  "function royaltyInfo(uint256 tokenId, uint256 salePriceWei) external view returns (address receiver, uint256 royaltyAmount)",

  // 事件用于从交易回执 receipt.logs 中解析 tokenId、上架和成交信息。
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Minted(address indexed to, uint256 indexed tokenId, string tokenURI)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 priceWei)",
  "event Delisted(uint256 indexed tokenId, address indexed seller)",
  "event RoyaltySet(uint256 indexed tokenId, address indexed receiver, uint96 royaltyFeeBps)",
  "event Purchased(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 priceWei, address royaltyReceiver, uint256 royaltyAmountWei, uint256 sellerAmountWei)",
];

function buildContractAddressError(contractAddress) {
  if (contractAddress) {
    return "合约地址无效";
  }

  return "合约地址无效：请在 frontend/.env.local 设置 NEXT_PUBLIC_NFT_CONTRACT_ADDRESS";
}

// 统一校验并返回合约地址。传入 contractAddress 时优先使用传入值，否则使用环境变量默认地址。
export function resolveContractAddress(contractAddress = "") {
  const address = String(contractAddress || NFT_CONTRACT_ADDRESS).trim();
  if (!ethers.isAddress(address)) {
    throw new Error(buildContractAddressError(String(contractAddress).trim()));
  }
  return address;
}
