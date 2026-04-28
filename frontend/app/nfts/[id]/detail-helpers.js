export function createTradeProgress(flow, detail) {
  return {
    step: "wallet",
    detail,
    txHash: "",
    error: "",
    flow,
  };
}

export function applyTradeStage(setTradeProgress, stage, detail, txHash = "") {
  setTradeProgress((prev) => ({
    ...(prev || {}),
    step: stage,
    detail,
    txHash: txHash || prev?.txHash || "",
    error: "",
  }));
}

export function applyTradeError(setTradeProgress, errorMessage) {
  setTradeProgress((prev) => ({
    ...(prev || {}),
    step: prev?.step || "wallet",
    detail: `${prev?.flow === "list" ? "上架" : prev?.flow === "delist" ? "下架" : "购买"}流程已中断`,
    txHash: prev?.txHash || "",
    error: errorMessage,
  }));
}

export function createStageHandler(setTradeProgress, walletDetail) {
  return (stage, txHash) => {
    if (stage === "wallet") {
      applyTradeStage(setTradeProgress, "wallet", walletDetail);
    }
    if (stage === "chain") {
      applyTradeStage(
        setTradeProgress,
        "chain",
        "交易已广播，等待链上打包确认...",
        txHash,
      );
    }
  };
}

export function createFallbackRoyaltyInfo(nft) {
  const fallbackFeeBps = Number(nft?.royaltyFeeBps || 0);
  const fallbackPrice = Number(nft?.price || 0);
  const fallbackRoyalty =
    fallbackFeeBps > 0 ? (fallbackPrice * fallbackFeeBps) / 10000 : 0;
  return {
    receiver: nft?.royaltyReceiver || "",
    feeBps: fallbackFeeBps,
    royaltyEth: fallbackRoyalty,
    sellerReceiveEth: Math.max(fallbackPrice - fallbackRoyalty, 0),
  };
}

export function createOrderHistoryEntry({ nft, order, owner, purchase }) {
  return {
    id: order.id,
    nftId: nft.id,
    priceWei: order.priceWei,
    price: order.price,
    txHash: order.txHash,
    status: order.status,
    createdAt: new Date().toISOString(),
    buyerWallet: purchase.account,
    sellerWallet: owner?.wallet || "",
  };
}
