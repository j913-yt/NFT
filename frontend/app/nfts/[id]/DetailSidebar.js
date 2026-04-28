import TxProgressCard from "@/components/TxProgressCard";
import { formatEth } from "@/lib/web3";

import { formatPrice } from "./detail-utils";

function SummaryStats({ categoryLabel, nft }) {
  return (
    <div className="mb-2 grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
        <p className="text-[11px] text-dim">链上编号</p>
        <p className="mt-1 text-sm font-black text-white">{nft.tokenId || "-"}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
        <p className="text-[11px] text-dim">分类</p>
        <p className="mt-1 text-sm font-black text-white">{categoryLabel}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
        <p className="text-[11px] text-dim">价格</p>
        <p className="mt-1 text-sm font-black text-white">
          {formatPrice(nft.price, nft.priceUnit)}
        </p>
      </div>
    </div>
  );
}

function MetadataCard({ nft, owner }) {
  return (
    <div className="space-y-1">
      <p className="break-all">拥有者: {owner?.wallet || "未知"}</p>
      <p className="break-all">所属合约: {nft.contract || "-"}</p>
      <p className="break-all">链上 URI: {nft.tokenUri || "-"}</p>
      <p className="break-all">元数据地址: {nft.metadataUrl || "-"}</p>
    </div>
  );
}

function RoyaltyCard({
  royaltyAmountEth,
  royaltyFeeBps,
  royaltyPercent,
  royaltyReceiver,
  sellerReceiveEth,
}) {
  return (
    <div className="mt-3 rounded-xl border border-[#78a8ff44] bg-[linear-gradient(120deg,rgba(78,130,255,0.14),rgba(14,24,40,0.8))] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#9eb8eb]">
          Royalty
        </p>
        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
          {royaltyPercent}%
        </span>
      </div>
      {royaltyFeeBps > 0 ? (
        <div className="mt-2 space-y-1 text-[11px] text-[#cbd8f8]">
          <p className="break-all">
            版税接收: <span className="text-white">{royaltyReceiver || "-"}</span>
          </p>
          <p>
            按当前价格预计版税:{" "}
            <span className="font-semibold text-white">
              {formatEth(royaltyAmountEth)} ETH
            </span>
          </p>
          <p>
            卖家实收预计:{" "}
            <span className="font-semibold text-white">
              {formatEth(sellerReceiveEth)} ETH
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[#b5c7f1]">当前作品未启用版税</p>
      )}
    </div>
  );
}

function BuyAction({ buying, canBuy, onBuy }) {
  return (
    <button
      onClick={onBuy}
      disabled={buying || !canBuy}
      className="btn-primary w-full justify-center disabled:opacity-55"
    >
      {!canBuy ? "暂未上架" : buying ? "链上购买中..." : "真实购买（测试币）"}
    </button>
  );
}

function OwnerActions({
  delisting,
  isListed,
  listingPrice,
  onDelist,
  onRelist,
  relisting,
  setListingPrice,
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[12px] text-soft">
        {isListed ? "修改上架价格" : "该 NFT 当前未上架，输入新价格后可重新上架"}
      </p>
      <div className="flex items-center gap-2">
        <input
          className="input-neo"
          type="number"
          min="0"
          step="0.00000001"
          value={listingPrice}
          onChange={(event) => setListingPrice(event.target.value)}
          placeholder="输入 ETH 价格"
        />
        <button
          type="button"
          onClick={onRelist}
          disabled={relisting || delisting}
          className="btn-primary shrink-0 px-4 disabled:opacity-55"
        >
          {relisting ? "提交中..." : isListed ? "更新价格" : "重新上架"}
        </button>
        {isListed && (
          <button
            type="button"
            onClick={onDelist}
            disabled={relisting || delisting}
            className="btn-outline shrink-0 px-4 disabled:opacity-55"
          >
            {delisting ? "下架中..." : "下架"}
          </button>
        )}
      </div>
    </div>
  );
}

function TradeStatus({ message, messageType, tradeProgress }) {
  return (
    <>
      {tradeProgress && (
        <TxProgressCard
          title={
            tradeProgress.flow === "list"
              ? "上架进度"
              : tradeProgress.flow === "delist"
                ? "下架进度"
                : "购买进度"
          }
          steps={["wallet", "chain", "sync", "done"]}
          currentStep={tradeProgress.step}
          detail={tradeProgress.detail}
          txHash={tradeProgress.txHash}
          error={tradeProgress.error}
        />
      )}
      {message && <p className={`status-message ${messageType}`}>{message}</p>}
    </>
  );
}

export default function DetailSidebar({
  buying,
  canBuy,
  categoryLabel,
  delisting,
  handleBuy,
  handleDelist,
  handleRelist,
  isListed,
  isOwner,
  listingPrice,
  message,
  messageType,
  nft,
  owner,
  relisting,
  royaltyAmountEth,
  royaltyFeeBps,
  royaltyPercent,
  royaltyReceiver,
  sellerReceiveEth,
  setListingPrice,
  tradeProgress,
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="badge">藏品详情</span>
        <h1 className="mt-3 text-4xl font-black text-white">
          {nft.name || "未命名 NFT"}
        </h1>
        <p className="mt-2 text-sm leading-7 text-soft">
          {nft.description || "暂无描述"}
        </p>
      </div>

      <div className="glass-panel p-4 text-xs text-soft">
        <SummaryStats categoryLabel={categoryLabel} nft={nft} />
        <MetadataCard nft={nft} owner={owner} />
        <RoyaltyCard
          royaltyAmountEth={royaltyAmountEth}
          royaltyFeeBps={royaltyFeeBps}
          royaltyPercent={royaltyPercent}
          royaltyReceiver={royaltyReceiver}
          sellerReceiveEth={sellerReceiveEth}
        />
      </div>

      {isOwner ? (
        <OwnerActions
          delisting={delisting}
          isListed={isListed}
          listingPrice={listingPrice}
          onDelist={handleDelist}
          onRelist={handleRelist}
          relisting={relisting}
          setListingPrice={setListingPrice}
        />
      ) : (
        <BuyAction buying={buying} canBuy={canBuy} onBuy={handleBuy} />
      )}

      <TradeStatus
        message={message}
        messageType={messageType}
        tradeProgress={tradeProgress}
      />
    </div>
  );
}
