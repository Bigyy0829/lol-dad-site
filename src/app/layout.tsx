import type { Metadata } from "next";
import Link from "next/link";
import "../../tokens.css";
import "./globals.css";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "撸啊撸职业父与子",
  description:
    "输入两名英雄联盟职业选手 ID，查看全部历史交手数据，看看谁是谁的爹。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label="撸啊撸职业父与子 首页">
              <span className="brand-mark" aria-hidden="true">
                父
              </span>
              <span className="brand-text">
                撸啊撸<span className="brand-accent">职业父与子</span>
              </span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="container">
            <p className="footer-line">
              数据来源：Oracle&apos;s Elixir（全球职业比赛，持续更新）· 结论仅供娱乐，请勿当真
            </p>
            <p className="footer-line">谁是谁的爹，数据说了算；谁是谁的儿，看了别急。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
