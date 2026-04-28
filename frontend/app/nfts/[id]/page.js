"use client";

import { useParams } from "next/navigation";

import DetailSidebar from "./DetailSidebar";
import { categoryLabelMap, formatRoyaltyPercent, hasPositiveWei, TX_EXPLORER_BASE } from "./detail-utils";
import PrimaryMedia from "./PrimaryMedia";
import TradeHistorySection from "./TradeHistorySection";
import { useNFTDetail } from "./use-nft-detail";

export default function NFTDetailPage() {
  const params = useParams();
  const detail = useNFTDetail(params?.id);

  const royaltyFeeBps = Number(
    detail.royaltyInfo?.feeBps ?? detail.nft?.royaltyFeeBps ?? 0,
  );
  const royaltyAmountEth = Number(
    detail.royaltyInfo?.royaltyEth ??
      (Number(detail.nft?.price || 0) * royaltyFeeBps) / 10000,
  );
  const sellerReceiveEth = Number(
    detail.royaltyInfo?.sellerReceiveEth ??
      Math.max(Number(detail.nft?.price || 0) - royaltyAmountEth, 0),
  );
  const isListed = hasPositiveWei(detail.nft?.priceWei);
  const canBuy = !detail.isOwner && isListed;
  const categoryLabel = categoryLabelMap[detail.nft?.category] || "其他";
  const royaltyPercent = formatRoyaltyPercent(royaltyFeeBps);
  const royaltyReceiver =
    detail.royaltyInfo?.receiver || detail.nft?.royaltyReceiver || "";

  if (detail.loading) {
    return (
      <div className="glass-panel mx-auto w-full max-w-5xl px-6 py-10 text-sm text-soft">
        正在加载 NFT 详情...
      </div>
    );
  }

  if (!detail.nft) {
    return (
      <div className="glass-panel mx-auto w-full max-w-5xl px-6 py-10 text-sm text-soft">
        NFT 不存在或已下架
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="glass-panel hero-glow relative overflow-hidden p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <PrimaryMedia nft={detail.nft} />
          <DetailSidebar
            buying={detail.buying}
            canBuy={canBuy}
            categoryLabel={categoryLabel}
            delisting={detail.delisting}
            handleBuy={detail.handleBuy}
            handleDelist={detail.handleDelist}
            handleRelist={detail.handleRelist}
            isListed={isListed}
            isOwner={detail.isOwner}
            listingPrice={detail.listingPrice}
            message={detail.message}
            messageType={detail.messageType}
            nft={detail.nft}
            owner={detail.owner}
            relisting={detail.relisting}
            royaltyAmountEth={royaltyAmountEth}
            royaltyFeeBps={royaltyFeeBps}
            royaltyPercent={royaltyPercent}
            royaltyReceiver={royaltyReceiver}
            sellerReceiveEth={sellerReceiveEth}
            setListingPrice={detail.setListingPrice}
            tradeProgress={detail.tradeProgress}
          />
        </div>
      </section>

      <TradeHistorySection
        historyError={detail.historyError}
        loadingHistory={detail.loadingHistory}
        orderHistory={detail.orderHistory}
        txExplorerBase={TX_EXPLORER_BASE}
      />
    </div>
  );
}
