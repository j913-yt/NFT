import { ethers } from "ethers";

import { NFT_CONTRACT_ABI, resolveContractAddress } from "./constants";
import { shortAddress } from "./utils";

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

function matchesExpectedAddress(value, expected) {
  if (!expected) {
    return true;
  }

  return String(value || "").trim().toLowerCase() === expected;
}

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
      // ignore unrelated logs
    }
  }

  return "";
}

export function createNFTContract({ contractAddress = "", runner }) {
  return new ethers.Contract(
    resolveContractAddress(contractAddress),
    NFT_CONTRACT_ABI,
    runner,
  );
}

export function parseMintedTokenId(contract, receipt, expectedTo = "") {
  const normalizedExpected = String(expectedTo || "").trim().toLowerCase();
  return (
    findMintedTokenId(contract, receipt, "Minted", normalizedExpected) ||
    findMintedTokenId(contract, receipt, "Transfer", normalizedExpected)
  );
}

export function isMissingCallException(err) {
  return (
    err?.code === "CALL_EXCEPTION" &&
    (err?.data == null ||
      String(err?.shortMessage || "").includes("missing revert data"))
  );
}

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
      // try the next read variant
    }
  }

  return null;
}

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
