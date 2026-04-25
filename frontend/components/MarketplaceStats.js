"use client";

import { formatPrice, summarizeNFTs } from "@/lib/marketplace";

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MarketplaceStats({ nfts, loading = false }) {
  const stats = summarizeNFTs(nfts);
  const loadingText = "...";

  const metrics = [
    { label: "在售数量", value: loading ? loadingText : `${stats.listed} 件` },
    { label: "藏品总数", value: loading ? loadingText : `${stats.total} 件` },
    { label: "地板价", value: loading ? loadingText : formatPrice(stats.floor, "ETH") },
    { label: "平均价", value: loading ? loadingText : formatPrice(stats.avg, "ETH") },
    { label: "热门分类", value: loading ? loadingText : stats.topCategory }
  ];

  return (
    <div className="metric-grid sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((item) => (
        <MetricCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
