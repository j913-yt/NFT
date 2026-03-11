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
  title: "NFT数字藏品市场",
  description: "支持钱包登录与 IPFS 铸造的 NFT 市场"
};

const feedItems = [
  { href: "/nfts", label: "NFT 藏品" },
  { href: "/nfts/create", label: "创建" },
  { href: "/profile", label: "我的" }
];

const mobileItems = [
  { href: "/", label: "首页" },
  { href: "/nfts", label: "市场" },
  { href: "/nfts/create", label: "创建" },
  { href: "/profile", label: "个人中心" }
];

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className={`${sora.variable} ${space.variable} font-[var(--font-sora)]`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-[#0f1726] focus:px-3 focus:py-2 focus:text-xs focus:text-white"
        >
          跳转到主内容
        </a>

        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1118dd] backdrop-blur-xl">
            <div className="mx-auto max-w-[1320px] px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <Link href="/" className="flex items-center gap-2.5">
                    <div className="float-chip flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4b86ff] to-[#2bbf9c] text-sm font-black text-white shadow-lg shadow-[#4b86ff55]">
                      B
                    </div>
                    <div>
                      <p className="text-sm font-extrabold tracking-wide text-white">NFT数字藏品市场</p>
                    </div>
                  </Link>

                  <div className="hidden items-center gap-2 md:flex">
                    <details className="group relative">
                      <summary className="cursor-pointer list-none rounded-lg px-3 py-1.5 text-xs font-semibold text-[#d8dff1] transition hover:bg-white/10">
                        导航
                      </summary>
                      <div className="absolute left-0 top-[110%] w-52 rounded-xl border border-white/15 bg-[#12192a] p-2 shadow-2xl shadow-black/40">
                        {feedItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="block rounded-lg px-3 py-2 text-xs font-semibold text-[#d6deef] hover:bg-white/10"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </details>
                    <Link href="/nfts" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#d8dff1] hover:bg-white/10">
                      浏览
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href="/nfts/create" className="btn-outline px-3 py-1.5 text-xs">
                    创建
                  </Link>
                  <WalletConnectButton />
                </div>
              </div>

              <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
                {mobileItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#d8dff1] hover:bg-white/10"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main id="main-content">
            <div className="mx-auto flex max-w-[1320px] px-4 py-8 sm:px-6">{children}</div>
          </main>

        </div>
      </body>
    </html>
  );
}


