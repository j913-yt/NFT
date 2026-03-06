import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <section className="glass-panel hero-glow relative overflow-hidden px-6 py-8 sm:px-8">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-5">
            <span className="badge">Nova NFT 信息流</span>
            <h1 className="section-title max-w-2xl text-4xl sm:text-5xl">
              一站式创建、铸造与交易
              <br />
              多媒体 NFT
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-soft">
              支持钱包签名登录、IPFS 元数据上链、图片/音频/视频统一展示。
              整套交互按真实 NFT 市场形态设计，可直接用于毕业答辩展示完整链路。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/nfts" className="btn-primary px-5 py-2.5">
                进入市场
              </Link>
              <Link href="/nfts/create" className="btn-outline px-5 py-2.5">
                创建 NFT
              </Link>
            </div>
          </div>

          <div className="glass-panel pulse-edge relative overflow-hidden p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(63,123,255,0.2),transparent_65%)]" />
            <div className="relative z-10 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9fb2ea]">
                上线流程清单
              </p>
              <ol className="space-y-2 text-sm text-soft">
                <li>1. 连接钱包并签名登录</li>
                <li>2. 选择分类并上传媒体文件</li>
                <li>3. 上传到 IPFS 并写入链上 tokenURI</li>
                <li>4. 在市场和详情页展示收藏品</li>
              </ol>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#d2ddff]">
                提示：音频/视频建议上传封面，卡片视觉会更完整。
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel px-5 py-5 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-white">数据概览</h2>
          <Link href="/nfts" className="btn-outline px-3 py-1.5 text-xs">
            查看全部
          </Link>
        </div>
        <div className="neo-divider mb-4" />
        <div className="kpi-row text-xs text-soft">
          <div className="kpi-card">
            <p>NFT 藏品库</p>
            <strong>实时同步</strong>
            <p className="mt-1 text-dim">按分类聚合展示实时作品池</p>
          </div>
          <div className="kpi-card">
            <p>铸造链路</p>
            <strong>IPFS + ERC-721</strong>
            <p className="mt-1 text-dim">媒体文件和 metadata 分离上链</p>
          </div>
          <div className="kpi-card">
            <p>市场体验</p>
            <strong>暗色霓虹风格</strong>
            <p className="mt-1 text-dim">卡片、筛选、详情统一视觉系统</p>
          </div>
        </div>
      </section>
    </div>
  );
}
