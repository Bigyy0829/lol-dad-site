"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayerAutocomplete from "@/components/PlayerAutocomplete";
import RiftBackdrop from "@/components/RiftBackdrop";
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

  function playerMeta(p: Player | null) {
    if (!p) return "支持中文昵称与英文 ID";
    const team = p.teams.slice(0, 2).join(" · ") || "暂无战队";
    const pos = p.positions.length ? ` · ${p.positions[0]}` : "";
    return `${team}${pos} · ${p.games.toLocaleString()} 局`;
  }

  return (
    <>
      <section className="home-hero">
        <RiftBackdrop />
        <p className="hero-kicker">Summoner&apos;s Rift H2H</p>
        <h1 className="hero-title">
          谁是谁的<span className="hl">爹</span>，数据说了算
        </h1>
        <p className="hero-sub">
          输入两名英雄联盟职业选手的 ID，一键查看两人全部历史交手记录与总胜率，
          得出「父子关系」鉴定结论。
        </p>
        <p className="scroll-cue">↓ 选择选手，开始鉴定</p>
      </section>

      <section className="container" aria-label="选手对位选择">
        <div className="duel-panel">
          <div className="panel-head">
            <h2 className="panel-title">选择对位选手</h2>
          </div>

          <div className="duel-row">
            <div className="duel-slot slot-a">
              <div className="slot-head">
                <span className="slot-hex" aria-hidden="true">
                  A
                </span>
                <span className="slot-title">选手 A</span>
                <span className="slot-side">Blue Side</span>
              </div>
              <PlayerAutocomplete
                value={a}
                onSelect={setA}
                placeholder="选手 A，如 Bin"
              />
              <div className="slot-meta" aria-live="polite">
                {playerMeta(a)}
              </div>
            </div>

            <div className="vs-crest" aria-hidden="true">
              VS
            </div>

            <div className="duel-slot slot-b">
              <div className="slot-head">
                <span className="slot-hex" aria-hidden="true">
                  B
                </span>
                <span className="slot-title">选手 B</span>
                <span className="slot-side">Red Side</span>
              </div>
              <PlayerAutocomplete
                value={b}
                onSelect={setB}
                placeholder="选手 B，如 Faker"
              />
              <div className="slot-meta" aria-live="polite">
                {playerMeta(b)}
              </div>
            </div>
          </div>

          <div className="duel-actions">
            <button className="btn btn-outline" onClick={swap} disabled={!a && !b}>
              ⇄ 交换
            </button>
            <button className="btn btn-gold" onClick={fight} disabled={!a || !b}>
              开打！鉴定父子
            </button>
          </div>

          <p className="swap-hint">
            支持中文昵称与英文 ID 搜索（如 阿水 / JKL / 晒哥）。想直接看排行？{" "}
            <Link href="/ranking">去爹榜/儿榜 →</Link>
          </p>
        </div>
      </section>
    </>
  );
}
