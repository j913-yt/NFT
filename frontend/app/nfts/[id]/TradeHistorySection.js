import Link from "next/link";

import { formatPrice, formatTime, shortHex } from "./detail-utils";

function EmptyTradeHistory() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-xs text-soft">
      <p>暂无交易记录（首发作品尚未成交）。</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Link href="/nfts" className="btn-outline px-3 py-1.5 text-xs">
          去市场浏览
        </Link>
        <Link href="/nfts/create" className="btn-primary px-3 py-1.5 text-xs">
          去创建 NFT
        </Link>
      </div>
    </div>
  );
}

function TradeHistoryItem({ item, txExplorerBase }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">
          成交价: {formatPrice(item.price, "ETH")}
        </p>
        <p>{formatTime(item.createdAt)}</p>
      </div>
      <p className="mt-1">卖家: {item.sellerName || shortHex(item.sellerWallet)}</p>
      <p className="mt-1">买家: {item.buyerName || shortHex(item.buyerWallet)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span>交易:</span>
        {item.txHash ? (
          <a
            href={`${txExplorerBase}${item.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#7fb2ff] underline-offset-2 hover:underline"
          >
            {shortHex(item.txHash, 10, 8)}
          </a>
        ) : (
          <span>-</span>
        )}
      </div>
    </div>
  );
}

export default function TradeHistorySection({
  historyError,
  loadingHistory,
  orderHistory,
  txExplorerBase,
}) {
  return (
    <section className="glass-panel px-5 py-4">
      <div className="mb-3 flex items-center gap-4 text-sm font-semibold">
        <span className="border-b-2 border-[#ff1f9b] pb-1 text-[#ff7bc8]">
          活动记录
        </span>
        <span className="text-soft">成交历史</span>
      </div>
      <div className="neo-divider mb-3" />

      {loadingHistory && (
        <p className="status-message info">正在加载交易记录...</p>
      )}
      {historyError && <p className="status-message error">{historyError}</p>}

      {!loadingHistory && !historyError && orderHistory.length === 0 ? (
        <EmptyTradeHistory />
      ) : (
        <div className="space-y-2">
          {orderHistory.map((item) => (
            <TradeHistoryItem
              key={item.id}
              item={item}
              txExplorerBase={txExplorerBase}
            />
          ))}
        </div>
      )}
    </section>
  );
}
