"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Button, Navbar, NavbarBrand, NavbarContent, NavbarItem, ScrollShadow, Tooltip } from "@nextui-org/react";
import DynamicWalletConnectButton from "@/components/DynamicWalletConnectButton";

function NotificationBellLoading() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 rounded-xl border border-[#86a4e733] bg-[#162645] opacity-70"
    />
  );
}

const NotificationBell = dynamic(
  () => import("@/components/NotificationBell"),
  {
    ssr: false,
    loading: NotificationBellLoading,
  },
);

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
    <NextLink href="/" className="brand-mark" aria-label="Nova NFT Market">
      <Image src="/logo-mark.svg" alt="" width={40} height={40} className="float-chip" />
      <span>
        <span className="brand-title block">Nova NFT Market</span>
        <span className="brand-subtitle block">数字藏品交易平台</span>
      </span>
    </NextLink>
  );
}

function NavButton({ item, active, mobile }) {
  const button = (
    <Button
      as={NextLink}
      href={item.href}
      color={active ? "primary" : "default"}
      radius="full"
      size={mobile ? "sm" : "md"}
      variant={active ? "flat" : "light"}
      className="font-semibold"
    >
      {item.label}
    </Button>
  );

  if (mobile) return button;
  return <NavbarItem isActive={active}>{button}</NavbarItem>;
}

function NavLinks({ pathname, mobile = false }) {
  return NAV_ITEMS.map((item) => (
    <NavButton
      key={item.href}
      item={item}
      mobile={mobile}
      active={isActiveRoute(pathname, item.href)}
    />
  ));
}

function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Tooltip content="上传媒体并铸造 NFT" delay={250}>
        <Button as={NextLink} href="/nfts/create" color="primary" radius="full" size="sm" variant="flat">
          发布作品
        </Button>
      </Tooltip>
      <NotificationBell />
      <DynamicWalletConnectButton />
    </div>
  );
}

export default function AppHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="app-header">
      <Navbar isBlurred maxWidth="full" className="bg-transparent" classNames={{ wrapper: "app-header-inner" }}>
        <NavbarBrand><Brand /></NavbarBrand>
        <NavbarContent className="hidden gap-2 lg:flex" justify="center">
          <NavLinks pathname={pathname} />
        </NavbarContent>
        <NavbarContent justify="end"><HeaderActions /></NavbarContent>
      </Navbar>

      <ScrollShadow orientation="horizontal" className="mx-auto max-w-[1320px] px-4 pb-3 lg:hidden">
        <nav className="flex gap-2" aria-label="移动端导航">
          <NavLinks pathname={pathname} mobile />
        </nav>
      </ScrollShadow>
    </header>
  );
}
