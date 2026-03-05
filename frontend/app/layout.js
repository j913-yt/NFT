import "./globals.css";
import Link from "next/link";
import dynamic from "next/dynamic";

const WalletConnectButton = dynamic(
  () => import("../components/WalletConnectButton"),
  { ssr: false }
);

export const metadata = {
  title: "NovaNFT | 数字藏品商城",
  description: "基于区块链的现代化 NFT 数字藏品交易平台"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 shadow-lg shadow-sky-500/40">
                  <span className="text-xs font-bold text-slate-950">NFT</span>
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-50">
                    NovaNFT 市场
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Graduation Project · Web3 Marketplace
                  </p>
                </div>
              </Link>

              <nav className="flex items-center gap-6 text-xs font-medium text-slate-300">
                <Link
                  href="/nfts"
                  className="hover:text-white hover:underline underline-offset-4"
                >
                  市场
                </Link>
                <Link
                  href="/nfts/create"
                  className="hover:text-white hover:underline underline-offset-4"
                >
                  创建 NFT
                </Link>
                <Link
                  href="/profile"
                  className="hover:text-white hover:underline underline-offset-4"
                >
                  个人中心
                </Link>
                <div className="hidden items-center gap-2 sm:flex">
                  <WalletConnectButton />
                </div>
              </nav>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto flex max-w-6xl px-5 py-8">{children}</div>
          </main>

          <footer className="border-t border-white/10 bg-slate-950/80">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 text-[11px] text-slate-500">
              <p>© {new Date().getFullYear()} NovaNFT · 毕业设计示例项目</p>
              <p className="hidden sm:block">
                Tech Stack: Next.js · TailwindCSS · Go · GORM · Web3
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

