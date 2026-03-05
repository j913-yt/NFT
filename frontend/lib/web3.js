import { ethers } from "ethers";

// TODO: 部署合约后，把实际地址和 ABI 替换到这里
export const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0xYourDeployedContractAddress";

// 与 contracts/NFTCollection.sol 对应的最小 ABI 片段
export const NFT_CONTRACT_ABI = [
  "function safeMint(address to, string uri) external returns (uint256)",
  "event Minted(address indexed to, uint256 indexed tokenId, string tokenURI)"
];

export function detectInjectedWallets() {
  if (typeof window === "undefined") return [];

  const results = [];
  const eth = window.ethereum;
  const providers = eth?.providers || (eth ? [eth] : []);

  const pushIf = (provider, id, name) => {
    if (!provider) return;
    if (results.find((w) => w.provider === provider)) return; // 避免重复
    results.push({ id, name, provider });
  };

  for (const p of providers) {
    // 一些钱包（例如 OKX）会同时把 isMetaMask 设为 true，所以判断顺序一定要“先专属、后 MetaMask”
    if (p.isOkxWallet || p.isOKExWallet) {
      pushIf(p, "okx", "OKX Wallet");
    } else if (p.isBitKeep || p.isBitgetWallet) {
      pushIf(p, "bitget", "Bitget Wallet");
    } else if (p.isMetaMask) {
      pushIf(p, "metamask", "MetaMask");
    }
  }

  // 兼容部分钱包在 window 上挂独立对象
  const okx = window.okxwallet?.ethereum || window.okxwallet;
  if (okx && !results.find((w) => w.id === "okx")) {
    pushIf(okx, "okx", "OKX Wallet");
  }
  const bitkeep = window.bitkeep?.ethereum || window.bitkeep;
  if (bitkeep && !results.find((w) => w.id === "bitget")) {
    pushIf(bitkeep, "bitget", "Bitget Wallet");
  }

  // 如果一个都没识别出来但有 window.ethereum，就给一个“默认钱包”
  if (!results.length && eth) {
    pushIf(eth, "injected", "浏览器默认钱包");
  }

  return results;
}

export async function getProviderAndSigner(preferredId) {
  if (typeof window === "undefined") {
    throw new Error("仅在浏览器中可用");
  }

  const wallets = detectInjectedWallets();
  if (!wallets.length) {
    throw new Error("未检测到任何浏览器钱包，请先安装 MetaMask / OKX / Bitget 等钱包扩展");
  }

  let target = wallets[0];
  if (preferredId) {
    const found = wallets.find((w) => w.id === preferredId);
    if (found) target = found;
  }

  const provider = new ethers.BrowserProvider(target.provider);
  const accounts = await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();

  return { provider, signer, account: accounts[0] };
}

export async function mintNFTWithWallet({ tokenURI, walletId }) {
  const { signer, account } = await getProviderAndSigner(walletId);

  // 合约地址如果不是合法 0x 地址，ethers 会当成 ENS 名称去解析，
  // 而很多测试网（例如 base-sepolia）不支持 ENS，就会报 UNSUPPORTED_OPERATION(getEnsAddress)
  if (!ethers.isAddress(NFT_CONTRACT_ADDRESS)) {
    throw new Error(
      "合约地址无效：请在 frontend/.env.local 设置 NEXT_PUBLIC_NFT_CONTRACT_ADDRESS 为部署后的 0x 合约地址"
    );
  }

  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    signer
  );

  const tx = await contract.safeMint(account, tokenURI);
  const receipt = await tx.wait();

  // 默认从事件中解析 tokenId（也可以读取 totalMinted）
  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "Minted") {
        tokenId = parsed.args.tokenId.toString();
        break;
      }
    } catch {
      // ignore
    }
  }

  return {
    account,
    txHash: receipt.hash,
    tokenId
  };
}

