import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">父</span>
              <span>
                撸啊撸<span className="brand-accent">职业父与子</span>
              </span>
            </Link>
            <nav className="site-nav">
              <Link className="nav-link" href="/">
                首页
              </Link>
              <Link className="nav-link" href="/ranking">
                排行榜
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            数据来源：Oracle&apos;s Elixir（全球职业比赛，持续更新）· 结论仅供娱乐，请勿当真
            <br />
            谁是谁的爹，数据说了算；谁是谁的儿，看了别急。
          </div>
        </footer>
      </body>
    </html>
  );
}
