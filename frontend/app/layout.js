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

const NotificationBell = dynamic(
  () => import("../components/NotificationBell"),
  { ssr: false }
);

export const metadata = {
  title: "Nova NFT Market",
  description: "支持钱包登录、IPFS 铸造与链上交易的 NFT 数字藏品平台"
};

const desktopItems = [
  { href: "/nfts", label: "市场浏览" },
  { href: "/nfts/create", label: "发布作品" },
  { href: "/profile", label: "个人中心" }
];

const mobileItems = [
  { href: "/", label: "首页" },
  { href: "/nfts", label: "市场" },
  { href: "/nfts/create", label: "创建" },
  { href: "/profile", label: "我的" }
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

        <div className="min-h-screen pb-8">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b14dd] backdrop-blur-xl">
            <div className="mx-auto max-w-[1320px] px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/" className="group flex items-center gap-3">
                  <img
                    src="/logo-mark.svg"
                    alt="NFT logo"
                    className="float-chip h-10 w-10 rounded-xl object-cover shadow-lg shadow-[#4b86ff55] sm:h-11 sm:w-11"
                  />
                  <div>
                    <p className="font-[var(--font-space)] text-base font-bold tracking-wide text-white sm:text-xl">
                      Nova NFT Market
                    </p>
                    <p className="text-[11px] text-[#b9c7e8] sm:text-xs">
                      数字藏品展示与交易平台
                    </p>
                  </div>
                </Link>

                <nav className="hidden items-center gap-2 lg:flex">
                  {desktopItems.map((item) => (
                    <Link key={item.href} href={item.href} className="top-nav-pill">
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="flex items-center gap-2">
                  <Link href="/nfts/create" className="btn-outline px-3 py-1.5 text-xs">
                    立即发布
                  </Link>
                  <NotificationBell />
                  <WalletConnectButton />
                </div>
              </div>

              <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
                {mobileItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="top-nav-pill whitespace-nowrap text-xs"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main id="main-content">
            <div className="mx-auto flex w-full max-w-[1320px] px-4 py-8 sm:px-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
