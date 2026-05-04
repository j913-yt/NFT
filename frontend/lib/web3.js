// web3 模块统一出口。
// 页面层从这里导入钱包、合约、价格换算、铸造、上架、购买等链上交互能力。
export {
  MAX_ROYALTY_BPS,
  NFT_CONTRACT_ABI,
  NFT_CONTRACT_ADDRESS,
  PREFERRED_WALLET_ID_KEY,
  resolveContractAddress,
} from "./web3/constants";
export {
  convertPriceToEth,
  formatEth,
  normalizeRoyaltyBps,
  toEthWei,
} from "./web3/pricing";
export {
  detectInjectedWallets,
  getPreferredWalletId,
  getProviderAndSigner,
  setPreferredWalletId,
} from "./web3/wallet";
export {
  buyNFTWithWallet,
  delistNFTWithWallet,
  getOnChainListing,
  getRoyaltyInfoOnChain,
  getTokenOwnerOnChain,
  listNFTWithWallet,
  mintNFTWithWallet,
} from "./web3/chain";
