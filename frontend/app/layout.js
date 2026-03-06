import "./globals.css";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Sora, Space_Grotesk } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"]
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["400", "500", "700"]
});

const WalletConnectButton = dynamic(
  () => import("../components/WalletConnectButton"),
  { ssr: false }
);

export const metadata = {
  title: "NovaNFT 市场",
  description: "支持钱包登录与 IPFS 铸造的多媒体 NFT 市场"
};

const navItems = [
  { href: "/nfts", label: "浏览" },
  { href: "/nfts/create", label: "创建" },
  { href: "/profile", label: "个人中心" }
];

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className={`${sora.variable} ${space.variable} font-[var(--font-sora)]`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-[#0b1122] focus:px-3 focus:py-2 focus:text-xs focus:text-white">
          跳转到主内容
        </a>

        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06070bdd] backdrop-blur-xl">
            <div className="mx-auto max-w-[1320px] px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <Link href="/" className="flex items-center gap-2.5">
                    <div className="float-chip flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3f7bff] to-[#ff1f9b] text-sm font-black text-white shadow-lg shadow-[#3f7bff66]">
                      N
                    </div>
                    <div>
                      <p className="text-sm font-extrabold tracking-wide text-white">Nova 市场</p>
                      <p className="text-[11px] text-[#8fa1d7]">NFT 信息流</p>
                    </div>
                  </Link>

                  <nav className="hidden items-center gap-2 md:flex">
                    {navItems.map((item) => (
                      <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#d8dfff] hover:bg-white/10">
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="flex items-center gap-2">
                  <Link href="/nfts/create" className="btn-outline px-3 py-1.5 text-xs">
                    创建
                  </Link>
                  <WalletConnectButton />
                </div>
              </div>

              <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#d8dfff] hover:bg-white/10">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main id="main-content">
            <div className="mx-auto flex max-w-[1320px] px-4 py-8 sm:px-6">{children}</div>
          </main>

          <footer className="border-t border-white/10 bg-[#06070bbb]">
            <div className="mx-auto flex max-w-[1320px] flex-col gap-1 px-4 py-4 text-[11px] text-[#8792b4] sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>NovaNFT 毕业设计市场</p>
              <p>Next.js / Go / MySQL / 钱包登录 / IPFS</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
