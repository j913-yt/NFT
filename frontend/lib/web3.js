import { ethers } from "ethers";

export const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0xYourDeployedContractAddress";

export const MAX_ROYALTY_BPS = 2500;
export const PREFERRED_WALLET_ID_KEY = "preferred_wallet_id";

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

const ETH_PRICE_USD = Number(process.env.NEXT_PUBLIC_ETH_PRICE_USD || "3000");
const USD_TO_CNY = Number(process.env.NEXT_PUBLIC_USD_TO_CNY || "7.2");
const BNB_TO_ETH = Number(process.env.NEXT_PUBLIC_BNB_TO_ETH || "0.12");
const MATIC_TO_ETH = Number(process.env.NEXT_PUBLIC_MATIC_TO_ETH || "0.0002");

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function shortAddress(value) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function getPreferredWalletId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PREFERRED_WALLET_ID_KEY) || "";
}

export function setPreferredWalletId(walletId) {
  if (typeof window === "undefined") return;
  const next = String(walletId || "").trim();
  if (!next) {
    window.localStorage.removeItem(PREFERRED_WALLET_ID_KEY);
    return;
  }
  window.localStorage.setItem(PREFERRED_WALLET_ID_KEY, next);
}

function readLoggedInWallet() {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem("current_user");
  if (!raw) return "";

  try {
    const user = JSON.parse(raw);
    return String(user?.wallet || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function assertLoggedInWallet(account, actionLabel = "当前操作") {
  const expected = readLoggedInWallet();
  if (!expected) return;

  const actual = String(account || "").trim().toLowerCase();
  if (!actual || actual === expected) return;

  throw new Error(
    `${actionLabel}使用的钱包 ${shortAddress(account)} 与当前登录钱包 ${shortAddress(expected)} 不一致，请切换到登录钱包后重试`,
  );
}

function toSafeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

export function normalizeRoyaltyBps(value) {
  const n = toSafeInt(value);
  if (n <= 0) return 0;
  return Math.min(n, MAX_ROYALTY_BPS);
}

export function convertPriceToEth(value, unit = "ETH") {
  const amount = safeNumber(value);
  if (amount <= 0) return 0;

  const u = (unit || "ETH").toUpperCase();
  if (u === "ETH") return amount;
  if (u === "WEI") return amount / 1e18;
  if (u === "GWEI") return amount / 1e9;
  if (u === "BNB") return amount * BNB_TO_ETH;
  if (u === "MATIC") return amount * MATIC_TO_ETH;

  const ethUsd = ETH_PRICE_USD > 0 ? ETH_PRICE_USD : 3000;
  if (u === "USD" || u === "USDT" || u === "USDC") {
    return amount / ethUsd;
  }

  if (u === "CNY") {
    const usdCny = USD_TO_CNY > 0 ? USD_TO_CNY : 7.2;
    return amount / (ethUsd * usdCny);
  }

  return amount;
}

export function formatEth(value, fractionDigits = 8) {
  const n = safeNumber(value);
  if (n <= 0) return "0";
  return n.toFixed(fractionDigits).replace(/\.?0+$/, "");
}

function toEthAmountString(value) {
  const n = safeNumber(value);
  if (n <= 0) return "0";
  return n.toFixed(18).replace(/\.?0+$/, "") || "0";
}

function toEthWei(value) {
  const asString = toEthAmountString(value);
  const wei = ethers.parseEther(asString);
  if (wei <= 0n) {
    throw new Error("价格换算后过小，请提高价格");
  }
  return wei;
}

function assertContractAddress() {
  if (!ethers.isAddress(NFT_CONTRACT_ADDRESS)) {
    throw new Error(
      "合约地址无效：请在 frontend/.env.local 设置 NEXT_PUBLIC_NFT_CONTRACT_ADDRESS",
    );
  }
}

function parseMintedTokenId(contract, receipt, expectedTo = "") {
  const normalizedExpected = String(expectedTo || "").trim().toLowerCase();

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "Minted" &&
        (!normalizedExpected ||
          String(parsed.args.to || "").trim().toLowerCase() ===
            normalizedExpected)
      ) {
        return parsed.args.tokenId.toString();
      }
    } catch {
      // ignore unrelated logs
    }
  }

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "Transfer" &&
        String(parsed.args.from || "").trim().toLowerCase() ===
          ethers.ZeroAddress.toLowerCase() &&
        (!normalizedExpected ||
          String(parsed.args.to || "").trim().toLowerCase() ===
            normalizedExpected)
      ) {
        return parsed.args.tokenId.toString();
      }
    } catch {
      // ignore unrelated logs
    }
  }

  return "";
}

function isMissingCallException(err) {
  return (
    err?.code === "CALL_EXCEPTION" &&
    (err?.data == null ||
      String(err?.shortMessage || "").includes("missing revert data"))
  );
}

async function readListingCompat(contract, tokenId) {
  try {
    const [seller, priceWei, active] = await contract.getListing(tokenId);
    return { seller, priceWei, active: Boolean(active), source: "getListing" };
  } catch (err) {
    if (!isMissingCallException(err)) {
      throw err;
    }
  }

  const variants = [
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

  for (const v of variants) {
    try {
      const c = new ethers.Contract(
        NFT_CONTRACT_ADDRESS,
        v.abi,
        contract.runner,
      );
      const [seller, priceWei, active] = await c[v.fn](tokenId);
      return { seller, priceWei, active: Boolean(active), source: v.fn };
    } catch {
      // try next variant
    }
  }

  return null;
}

async function assertTokenOwner(contract, tokenId, account, actionLabel) {
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

async function hasBuyEntryPoint(contract, tokenId, from) {
  const provider = contract.runner?.provider;
  if (!provider) return true;

  try {
    const data = contract.interface.encodeFunctionData("buy", [tokenId]);
    await provider.call({ to: NFT_CONTRACT_ADDRESS, from, data, value: 0n });
    return true;
  } catch (err) {
    if (!isMissingCallException(err)) {
      return true;
    }
    return false;
  }
}

export function detectInjectedWallets() {
  if (typeof window === "undefined") return [];

  const results = [];
  const eth = window.ethereum;
  const providers = eth?.providers || (eth ? [eth] : []);

  const pushIf = (provider, id, name) => {
    if (!provider) return;
    if (results.find((w) => w.provider === provider)) return;
    results.push({ id, name, provider });
  };

  for (const p of providers) {
    if (p.isOkxWallet || p.isOKExWallet) {
      pushIf(p, "okx", "OKX 钱包");
    } else if (p.isBitKeep || p.isBitgetWallet) {
      pushIf(p, "bitget", "Bitget 钱包");
    } else if (p.isMetaMask) {
      pushIf(p, "metamask", "MetaMask 钱包");
    }
  }

  const okx = window.okxwallet?.ethereum || window.okxwallet;
  if (okx && !results.find((w) => w.id === "okx")) {
    pushIf(okx, "okx", "OKX 钱包");
  }

  const bitkeep = window.bitkeep?.ethereum || window.bitkeep;
  if (bitkeep && !results.find((w) => w.id === "bitget")) {
    pushIf(bitkeep, "bitget", "Bitget 钱包");
  }

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
    throw new Error("未检测到钱包，请先安装 MetaMask / OKX / Bitget 等扩展");
  }

  let target = wallets[0];
  const resolvedPreferredId =
    String(preferredId || getPreferredWalletId() || "").trim() || "";
  if (resolvedPreferredId) {
    const found = wallets.find((w) => w.id === resolvedPreferredId);
    if (found) target = found;
  }

  const provider = new ethers.BrowserProvider(target.provider);
  const accounts = await provider.send("eth_requestAccounts", []);
  if (!Array.isArray(accounts) || !accounts[0]) {
    throw new Error("钱包未返回可用账号，请先在钱包中授权");
  }

  const expectedWallet = readLoggedInWallet();
  const matchedAccount = expectedWallet
    ? accounts.find(
        (item) =>
          String(item || "").trim().toLowerCase() === expectedWallet,
      )
    : "";
  const account = String(matchedAccount || accounts[0]).trim();
  assertLoggedInWallet(account, "链上交易");
  setPreferredWalletId(target.id);
  const signer = await provider.getSigner(account);

  return { provider, signer, account, walletId: target.id };
}

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

export async function getTokenOwnerOnChain(tokenId) {
  if (!tokenId) {
    return "";
  }

  assertContractAddress();
  const provider = getReadOnlyProvider();
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    provider,
  );

  try {
    return await contract.ownerOf(tokenId);
  } catch {
    return "";
  }
}

export async function getRoyaltyInfoOnChain({
  tokenId,
  salePriceWei = "",
  salePriceEth = 0,
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法查询版税");
  }

  assertContractAddress();
  const provider = getReadOnlyProvider();
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    provider,
  );

  let saleWei = 0n;
  const rawWei = String(salePriceWei || "").trim();
  if (rawWei) {
    try {
      saleWei = BigInt(rawWei);
    } catch {
      saleWei = 0n;
    }
  }
  if (saleWei <= 0n) {
    const saleEth = safeNumber(salePriceEth);
    saleWei = saleEth > 0 ? toEthWei(saleEth) : 10n ** 18n;
  }

  let receiver = ethers.ZeroAddress;
  let royaltyAmount = 0n;
  let feeBps = 0;

  try {
    const [onChainReceiver, onChainRoyalty, onChainFeeBps] =
      await contract.getRoyaltyInfo(tokenId, saleWei);
    receiver = onChainReceiver;
    royaltyAmount = onChainRoyalty;
    feeBps = Number(onChainFeeBps);
  } catch {
    const [onChainReceiver, onChainRoyalty] = await contract.royaltyInfo(
      tokenId,
      saleWei,
    );
    receiver = onChainReceiver;
    royaltyAmount = onChainRoyalty;
    feeBps = saleWei > 0n ? Number((royaltyAmount * 10_000n) / saleWei) : 0;
  }

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

export async function getOnChainListing(tokenId, walletId) {
  assertContractAddress();
  const { signer } = await getProviderAndSigner(walletId);
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    signer,
  );

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

export async function mintNFTWithWallet({
  tokenURI,
  walletId,
  priceEth = 0,
  royaltyReceiver = "",
  royaltyFeeBps = 0,
  onStage,
}) {
  assertContractAddress();
  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    signer,
  );

  const normalizedPriceEth = safeNumber(priceEth);
  const normalizedRoyaltyBps = normalizeRoyaltyBps(royaltyFeeBps);
  const normalizedRoyaltyReceiver =
    normalizedRoyaltyBps > 0
      ? royaltyReceiver && ethers.isAddress(royaltyReceiver)
        ? royaltyReceiver
        : account
      : ethers.ZeroAddress;
  let tx;
  let listedPriceWei = 0n;

  onStage?.("wallet");
  if (normalizedPriceEth > 0) {
    listedPriceWei = toEthWei(normalizedPriceEth);
    try {
      tx = await contract["mintAndList(string,uint256,address,uint96)"](
        tokenURI,
        listedPriceWei,
        normalizedRoyaltyReceiver,
        normalizedRoyaltyBps,
      );
    } catch (err) {
      if (normalizedRoyaltyBps > 0 && isMissingCallException(err)) {
        throw new Error("当前合约不支持 EIP-2981 版税，请部署新版合约后再创建");
      }
      if (normalizedRoyaltyBps > 0 || !isMissingCallException(err)) {
        throw err;
      }
      tx = await contract["mintAndList(string,uint256)"](
        tokenURI,
        listedPriceWei,
      );
    }
  } else {
    try {
      tx = await contract["safeMint(address,string,address,uint96)"](
        account,
        tokenURI,
        normalizedRoyaltyReceiver,
        normalizedRoyaltyBps,
      );
    } catch (err) {
      if (normalizedRoyaltyBps > 0 && isMissingCallException(err)) {
        throw new Error("当前合约不支持 EIP-2981 版税，请部署新版合约后再创建");
      }
      if (normalizedRoyaltyBps > 0 || !isMissingCallException(err)) {
        throw err;
      }
      tx = await contract["safeMint(address,string)"](account, tokenURI);
    }
  }

  onStage?.("chain", tx.hash);
  const receipt = await tx.wait();
  onStage?.("confirmed", receipt.hash);
  let tokenId = parseMintedTokenId(contract, receipt, account);

  if (!tokenId) {
    const total = await contract.totalMinted();
    tokenId = total.toString();
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
  onStage,
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法上架");
  }
  const normalizedPrice = safeNumber(priceEth);
  if (normalizedPrice <= 0) {
    throw new Error("上架价格必须大于 0");
  }

  assertContractAddress();
  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    signer,
  );
  await assertTokenOwner(contract, tokenId, account, "上架");

  const priceWei = toEthWei(normalizedPrice);
  onStage?.("wallet");
  const tx = await contract.listToken(tokenId, priceWei);
  onStage?.("chain", tx.hash);
  const receipt = await tx.wait();
  onStage?.("confirmed", receipt.hash);

  return {
    account,
    txHash: receipt.hash,
    priceWei: priceWei.toString(),
    priceEth: Number(ethers.formatEther(priceWei)),
  };
}

export async function delistNFTWithWallet({ tokenId, walletId, onStage }) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法下架");
  }

  assertContractAddress();
  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    signer,
  );
  await assertTokenOwner(contract, tokenId, account, "下架");

  onStage?.("wallet");
  const tx = await contract.cancelListing(tokenId);
  onStage?.("chain", tx.hash);
  const receipt = await tx.wait();
  onStage?.("confirmed", receipt.hash);

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
  onStage,
}) {
  if (!tokenId) {
    throw new Error("链上编号无效，无法购买");
  }

  assertContractAddress();
  const { signer, account } = await getProviderAndSigner(walletId);
  const contract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    NFT_CONTRACT_ABI,
    signer,
  );

  let seller = "";
  let priceWei = 0n;
  let active = false;
  let listingSource = "";

  const listing = await readListingCompat(contract, tokenId);
  if (listing) {
    seller = listing.seller;
    priceWei = listing.priceWei;
    active = Boolean(listing.active);
    listingSource = listing.source;
  } else {
    const hasBuy = await hasBuyEntryPoint(contract, tokenId, account);
    if (!hasBuy) {
      throw new Error(
        "当前合约是旧版（仅支持铸造），不支持真实购买。请部署新版合约并更新 NEXT_PUBLIC_NFT_CONTRACT_ADDRESS",
      );
    }

    const fallbackWei = String(fallbackPriceWei || "").trim();
    if (fallbackWei) {
      try {
        priceWei = BigInt(fallbackWei);
        active = true;
        listingSource = "fallback-price-wei";
      } catch {
        throw new Error("后端返回的 priceWei 无效，无法发起购买");
      }
    } else {
      const fallback = safeNumber(fallbackPriceEth);
      if (fallback <= 0) {
        throw new Error(
          "当前合约无法读取上架信息，且没有可用价格，无法发起购买",
        );
      }
      priceWei = toEthWei(fallback);
      active = true;
      listingSource = "fallback-price";
    }
  }

  if (!active || priceWei <= 0n) {
    throw new Error("该 NFT 当前未上架");
  }

  if (seller && seller.toLowerCase() === account.toLowerCase()) {
    throw new Error("不能购买自己发布的 NFT");
  }

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

  onStage?.("wallet");
  const tx = await contract.buy(tokenId, { value: priceWei });
  onStage?.("chain", tx.hash);
  const receipt = await tx.wait();
  onStage?.("confirmed", receipt.hash);

  return {
    account,
    txHash: receipt.hash,
    priceWei: priceWei.toString(),
    priceEth: Number(ethers.formatEther(priceWei)),
    listingSource,
  };
}
