"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import WalletConnectButton from "@/components/WalletConnectButton";

const NAV_ITEMS = Object.freeze([
  { href: "/", label: "首页" },
  { href: "/nfts", label: "市场" },
  { href: "/nfts/create", label: "创建" },
  { href: "/profile", label: "我的" }
]);

function isActiveRoute(pathname, href) {
  if (href === "/") return pathname === "/";
  if (href === "/nfts") return pathname === "/nfts" || /^\/nfts\/(?!create)/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="brand-mark" aria-label="Nova NFT Market">
      <Image src="/logo-mark.svg" alt="" width={40} height={40} className="float-chip" />
      <span>
        <span className="brand-title block">Nova NFT Market</span>
        <span className="brand-subtitle block">数字藏品交易平台</span>
      </span>
    </Link>
  );
}

function NavLinks({ pathname, mobile = false }) {
  const className = mobile ? "top-nav-pill whitespace-nowrap" : "top-nav-pill";

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${className} ${isActiveRoute(pathname, item.href) ? "active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/nfts/create" className="btn-outline hidden px-3 py-2 text-xs sm:inline-flex">
        发布作品
      </Link>
      <NotificationBell />
      <WalletConnectButton />
    </div>
  );
}

export default function AppHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Brand />
          <nav className="hidden items-center gap-2 lg:flex" aria-label="主导航">
            <NavLinks pathname={pathname} />
          </nav>
          <HeaderActions />
        </div>

        <nav className="mobile-nav lg:hidden" aria-label="移动端导航">
          <NavLinks pathname={pathname} mobile />
        </nav>
      </div>
    </header>
  );
}
