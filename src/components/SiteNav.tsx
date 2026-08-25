"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteNav() {
  const pathname = usePathname();
  const isRanking = pathname.startsWith("/ranking");

  return (
    <nav className="site-nav" aria-label="主导航">
      <Link className={`nav-link ${pathname === "/" ? "active" : ""}`} href="/">
        首页
      </Link>
      <Link className={`nav-link ${isRanking ? "active" : ""}`} href="/ranking">
        排行榜
      </Link>
    </nav>
  );
}
