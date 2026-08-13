"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayerAutocomplete from "@/components/PlayerAutocomplete";
import type { Player } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [a, setA] = useState<Player | null>(null);
  const [b, setB] = useState<Player | null>(null);

  function swap() {
    setA(b);
    setB(a);
  }

  function fight() {
    if (a && b) {
      router.push(`/h2h/${a.id}/${b.id}`);
    }
  }

  return (
    <div className="container">
      <section className="hero">
        <h1 className="hero-title">
          谁是谁的<span className="hl">爹</span>，数据说了算
        </h1>
        <p className="hero-sub">
          输入两名英雄联盟职业选手的 ID，一键查看两人全部历史交手记录与总胜率，
          得出「父子关系」鉴定结论。
        </p>
      </section>

      <section className="search-panel">
        <div className="search-row">
          <PlayerAutocomplete
            value={a}
            onSelect={setA}
            placeholder="选手 A，如 Bin"
            autoFocus
          />
          <span className="vs-badge">VS</span>
          <PlayerAutocomplete
            value={b}
            onSelect={setB}
            placeholder="选手 B，如 Faker"
          />
        </div>
        <div className="search-actions">
          <button className="btn" onClick={swap} disabled={!a && !b}>
            ⇄ 交换
          </button>
          <button className="btn btn-gold" onClick={fight} disabled={!a || !b}>
            开打！鉴定父子
          </button>
        </div>
        <div className="swap-hint">
          支持中文昵称与英文 ID 搜索（如 阿水 / JKL / 晒哥）。想直接看排行？
          <Link href="/ranking" style={{ color: "var(--gold-2)" }}>
            {" "}
            去爹榜/儿榜 →
          </Link>
        </div>
      </section>
    </div>
  );
}
