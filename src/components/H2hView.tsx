"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { H2hData } from "@/lib/types";
import { verdict, type Verdict } from "@/lib/verdict";

interface Props {
  aId: number;
  bId: number;
  initialFrom?: string;
  initialTo?: string;
}

type Preset = "all" | "1y" | "2y" | "custom";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default function H2hView({ aId, bId, initialFrom, initialTo }: Props) {
  const router = useRouter();
  const [data, setData] = useState<H2hData | null>(null);
  const [verdictData, setVerdictData] = useState<Verdict | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"games" | "series">("games");
  const [preset, setPreset] = useState<Preset>(
    initialFrom || initialTo ? "custom" : "all"
  );
  const [customFrom, setCustomFrom] = useState(initialFrom ?? "");
  const [customTo, setCustomTo] = useState(initialTo ?? "");

  const effective = useMemo(() => {
    if (preset === "1y") return { from: daysAgo(365), to: "" };
    if (preset === "2y") return { from: daysAgo(730), to: "" };
    if (preset === "custom") return { from: customFrom, to: customTo };
    return { from: "", to: "" };
  }, [preset, customFrom, customTo]);

  const load = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ a: String(aId), b: String(bId) });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/h2h?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "查询失败");
          return;
        }
        setData(json);
        setVerdictData(
          verdict({
            aName: json.a.name,
            bName: json.b.name,
            samePlayer: aId === bId,
            games: json.summary.games,
            aWins: json.summary.aWins,
            bWins: json.summary.bWins,
            series: json.summary.series,
            aSeriesWins: json.summary.aSeriesWins,
            bSeriesWins: json.summary.bSeriesWins,
          })
        );
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [aId, bId]
  );

  useEffect(() => {
    const { from, to } = effective;
    load(from, to);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.replace(`/h2h/${aId}/${bId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [effective, load, aId, bId, router]);

  const directionClass = verdictData
    ? verdictData.direction === "a" || verdictData.direction === "b"
      ? `dir-${verdictData.direction}`
      : verdictData.direction === "tie"
        ? "dir-tie"
        : ""
    : "";

  return (
    <div className="container">
      {data && (
        <div className="player-chips">
          <div className="player-chip">
            <span className="pname">{data.a.name}</span>
            <span className="pmeta">
              {data.a.teams.slice(0, 2).join(" · ")} · {data.a.games.toLocaleString()} 局
            </span>
          </div>
          <span className="vs-badge">VS</span>
          <div className="player-chip">
            <span className="pname">{data.b.name}</span>
            <span className="pmeta">
              {data.b.teams.slice(0, 2).join(" · ")} · {data.b.games.toLocaleString()} 局
            </span>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <span className="spinner" />
          正在翻旧账…
        </div>
      )}

      {error && (
        <div className="error-box">
          <div>{error}</div>
          {(error.includes("no such table") || error.includes("unable to open")) && (
            <div className="muted">
              请先运行 <code>npm run data:refresh</code> 构建本地数据。
            </div>
          )}
        </div>
      )}

      {!loading && !error && verdictData && data && (
        <>
          <div className={`verdict ${directionClass}`}>
            <div className="verdict-kicker">父子关系鉴定报告</div>
            <h2
              className={`verdict-title ${
                verdictData.direction === "a" || verdictData.direction === "b"
                  ? "gold"
                  : ""
              }`}
            >
              {verdictData.title}
            </h2>
            <p className="verdict-sub">{verdictData.subtitle}</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-head">
                <span className="stat-title">小局战绩</span>
                <span className="stat-num">
                  共 {data.summary.games} 局 ·{" "}
                  {data.summary.firstDate || "?"} ~ {data.summary.lastDate || "?"}
                </span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-a"
                  style={{ width: `${data.summary.aWinRate * 100}%` }}
                />
                <div
                  className="bar-b"
                  style={{ width: `${data.summary.bWinRate * 100}%` }}
                />
              </div>
              <div className="bar-labels">
                <span>
                  <strong>{data.a.name}</strong> {data.summary.aWins} 胜（
                  {pct(data.summary.aWinRate)}）
                </span>
                <span>
                  {data.summary.bWins} 胜（{pct(data.summary.bWinRate)}）{" "}
                  <strong>{data.b.name}</strong>
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-head">
                <span className="stat-title">系列赛战绩</span>
                <span className="stat-num">共 {data.summary.series} 个系列</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-a"
                  style={{ width: `${data.summary.aSeriesWinRate * 100}%` }}
                />
                <div
                  className="bar-b"
                  style={{ width: `${data.summary.bSeriesWinRate * 100}%` }}
                />
              </div>
              <div className="bar-labels">
                <span>
                  <strong>{data.a.name}</strong> 赢下{" "}
                  {data.summary.aSeriesWins} 个系列
                </span>
                <span>
                  <strong>{data.b.name}</strong> 赢下 {data.summary.bSeriesWins}{" "}
                  个系列
                </span>
              </div>
            </div>
          </div>

          <div className="toolbar">
            <div className="seg">
              <button
                className={view === "games" ? "active" : ""}
                onClick={() => setView("games")}
              >
                小局记录
              </button>
              <button
                className={view === "series" ? "active" : ""}
                onClick={() => setView("series")}
              >
                系列赛记录
              </button>
            </div>
            <div className="presets">
              <button
                className={`preset ${preset === "all" ? "active" : ""}`}
                onClick={() => setPreset("all")}
              >
                全部历史
              </button>
              <button
                className={`preset ${preset === "1y" ? "active" : ""}`}
                onClick={() => setPreset("1y")}
              >
                近一年
              </button>
              <button
                className={`preset ${preset === "2y" ? "active" : ""}`}
                onClick={() => setPreset("2y")}
              >
                近两年
              </button>
              <button
                className={`preset ${preset === "custom" ? "active" : ""}`}
                onClick={() => setPreset("custom")}
              >
                自定义
              </button>
              {preset === "custom" && (
                <span className="custom-dates">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                  <span>至</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </span>
              )}
            </div>
          </div>

          {view === "games" ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>赛事</th>
                    <th>对阵</th>
                    <th>英雄</th>
                    <th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  {data.games.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                        该时间段内没有交手记录
                      </td>
                    </tr>
                  )}
                  {data.games.map((g, i) => (
                    <tr key={`${g.gameId}-${i}`}>
                      <td style={{ whiteSpace: "nowrap" }}>{g.date}</td>
                      <td>
                        <span className="league-pill">{g.league}</span>
                        {g.split ? ` ${g.split}` : ""}
                        {g.playoffs ? " · 季后赛" : ""}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {g.aTeam} vs {g.bTeam}
                      </td>
                      <td>
                        <div className="champ-cell">
                          <span className="champ-dot a" />
                          {g.aChampion || "-"}
                        </div>
                        <div className="champ-cell">
                          <span className="champ-dot b" />
                          {g.bChampion || "-"}
                        </div>
                      </td>
                      <td>
                        <span className={g.aResult === 1 ? "win-a" : "win-b"}>
                          {g.aResult === 1 ? `${data.a.name} 胜` : `${data.b.name} 胜`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>赛事</th>
                    <th>对阵</th>
                    <th>比分</th>
                    <th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                        该时间段内没有系列赛记录
                      </td>
                    </tr>
                  )}
                  {data.series.map((s, i) => (
                    <tr key={`${s.matchId}-${i}`}>
                      <td style={{ whiteSpace: "nowrap" }}>{s.date}</td>
                      <td>
                        <span className="league-pill">{s.league}</span>
                        {s.split ? ` ${s.split}` : ""}
                        {s.playoffs ? " · 季后赛" : ""}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {s.aTeam} vs {s.bTeam}
                      </td>
                      <td>
                        <span className="score-badge">
                          {s.aGames} - {s.bGames}
                        </span>
                      </td>
                      <td>
                        <span className={s.winner === "a" ? "win-a" : "win-b"}>
                          {s.winner === "a" ? `${data.a.name} 胜` : `${data.b.name} 胜`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="link-row">
            <Link className="btn btn-sm" href={`/ranking/${data.a.id}?type=dad`}>
              查看 {data.a.name} 的爹榜
            </Link>
            <Link className="btn btn-sm" href={`/ranking/${data.a.id}?type=son`}>
              查看 {data.a.name} 的儿榜
            </Link>
            <Link className="btn btn-sm" href={`/ranking/${data.b.id}?type=dad`}>
              查看 {data.b.name} 的爹榜
            </Link>
            <Link className="btn btn-sm" href={`/ranking/${data.b.id}?type=son`}>
              查看 {data.b.name} 的儿榜
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
