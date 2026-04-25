import "./globals.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/header.css";
import "./styles/marketplace.css";
import "./styles/animations.css";
import AppHeader from "@/components/AppHeader";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Nova NFT Market",
  description: "支持钱包登录、IPFS 铸造与链上交易的 NFT 数字藏品平台"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <Providers>
          <a href="#main-content" className="skip-link">跳转到主内容</a>
          <div className="min-h-screen pb-8">
            <AppHeader />
            <main id="main-content">
              <div className="page-shell">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
