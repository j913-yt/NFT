"use client";

import { Card, CardBody, Skeleton } from "@nextui-org/react";
import { formatPrice, summarizeNFTs } from "@/lib/marketplace";

function MetricCard({ label, value, loading }) {
  return (
    <Card className="border border-white/10 bg-white/[0.06]" shadow="none">
      <CardBody className="gap-2 p-4">
        <span className="text-xs text-dim">{label}</span>
        <Skeleton isLoaded={!loading} className="w-24 rounded-lg">
          <strong className="block text-xl font-black text-white">{value}</strong>
        </Skeleton>
      </CardBody>
    </Card>
  );
}

export default function MarketplaceStats({ nfts, loading = false }) {
  const stats = summarizeNFTs(nfts);
  const metrics = [
    { label: "在售数量", value: `${stats.listed} 件` },
    { label: "藏品总数", value: `${stats.total} 件` },
    { label: "地板价", value: formatPrice(stats.floor, "ETH") },
    { label: "平均价", value: formatPrice(stats.avg, "ETH") },
    { label: "热门分类", value: stats.topCategory }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((item) => (
        <MetricCard key={item.label} label={item.label} value={item.value} loading={loading} />
      ))}
    </div>
  );
}
