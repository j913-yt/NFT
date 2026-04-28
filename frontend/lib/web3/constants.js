import { ethers } from "ethers";

export const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0xYourDeployedContractAddress";

export const MAX_ROYALTY_BPS = 2500;
export const PREFERRED_WALLET_ID_KEY = "preferred_wallet_id";
export const BASIS_POINTS = 10_000n;
export const ONE_ETH_WEI = 10n ** 18n;
export const DEFAULT_ETH_PRICE_USD = 3000;
export const DEFAULT_USD_TO_CNY = 7.2;
export const DEFAULT_BNB_TO_ETH = 0.12;
export const DEFAULT_MATIC_TO_ETH = 0.0002;

export const NFT_CONTRACT_ABI = [
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function safeMint(address to, string uri) external returns (uint256)",
  "function safeMint(address to, string uri, address royaltyReceiver, uint96 royaltyFeeBps) external returns (uint256)",
  "function mintAndList(string uri, uint256 priceWei) external returns (uint256)",
  "function mintAndList(string uri, uint256 priceWei, address royaltyReceiver, uint96 royaltyFeeBps) external returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function listToken(uint256 tokenId, uint256 priceWei) external",
  "function cancelListing(uint256 tokenId) external",
  "function buy(uint256 tokenId) external payable",
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 priceWei, bool active)",
  "function getRoyaltyInfo(uint256 tokenId, uint256 salePriceWei) external view returns (address receiver, uint256 royaltyAmount, uint96 royaltyFeeBps)",
  "function royaltyInfo(uint256 tokenId, uint256 salePriceWei) external view returns (address receiver, uint256 royaltyAmount)",
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

export function resolveContractAddress(contractAddress = "") {
  const address = String(contractAddress || NFT_CONTRACT_ADDRESS).trim();
  if (!ethers.isAddress(address)) {
    throw new Error(buildContractAddressError(String(contractAddress).trim()));
  }
  return address;
}
