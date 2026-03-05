import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex w-full flex-col gap-8 lg:flex-row">
      <section className="glass-panel relative flex-1 overflow-hidden px-6 py-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.2),transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            实时链上 · 毕业设计 NFT 市场
          </div>

          <div>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              探索你的数字藏品宇宙
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-200/80">
              NovaNFT
              将传统的账号体系、Web3
              钱包与链上合约打通，完整演示一个现代化的 NFT 数字藏品交易流程，适合作为毕业设计展示你的区块链与全栈能力。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/nfts/create" className="btn-primary">
              连接钱包并创建 NFT
            </Link>
            <Link href="/nfts" className="btn-outline">
              浏览市场
            </Link>
            <span className="text-xs text-slate-300/80">
              或前往 <span className="font-medium text-sky-300">个人中心</span>{" "}
              查看你的资产
            </span>
          </div>

          <div className="mt-4 grid gap-4 text-xs text-slate-200/80 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3">
              <p className="text-[11px] text-slate-400">链上资产</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                NFT Mint 流程
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                前端连接钱包 · 合约 mint · 后端入库，一次演示讲清完整闭环。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3">
              <p className="text-[11px] text-slate-400">技术栈</p>
              <p className="mt-1 text-lg font-semibold text-sky-300">
                Next.js + Go + Web3
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                前后端分离 + REST API + 智能合约，覆盖主流企业级架构。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3">
              <p className="text-[11px] text-slate-400">适配毕业答辩</p>
              <p className="mt-1 text-lg font-semibold text-violet-300">
                逻辑清晰 · UI 现代
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                从用户注册、钱包连接到 NFT 创建和展示，一条龙演示项目亮点。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel flex w-full flex-col justify-between px-6 py-6 lg:w-80 lg:px-6">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            平台实时概览（示意）
          </h2>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2.5">
              <div>
                <p className="text-[11px] text-slate-400">已铸造 NFT 数量</p>
                <p className="text-lg font-semibold text-sky-300">∞</p>
              </div>
              <span className="badge">ERC-721</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2.5">
              <div>
                <p className="text-[11px] text-slate-400">支持的钱包</p>
                <p className="text-sm font-medium text-emerald-300">
                  MetaMask · OKX Wallet
                </p>
              </div>
              <span className="badge">Web3 Login</span>
            </div>
            <div className="rounded-xl bg-slate-900/70 px-3 py-3">
              <p className="text-[11px] text-slate-400">建议用于答辩的讲解顺序</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>从首页概览介绍系统架构</li>
                <li>演示钱包连接 / 登录与个人中心</li>
                <li>创建 NFT 并在市场页查看</li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

