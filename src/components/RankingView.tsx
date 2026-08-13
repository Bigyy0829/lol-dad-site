"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayerAutocomplete from "@/components/PlayerAutocomplete";
import type { Player, RankingEntry } from "@/lib/types";

interface Props {
  playerId?: number;
  initialType?: "dad" | "son";
  initialMinGames?: number;
  initialFrom?: string;
  initialTo?: string;
}

type Preset = "all" | "1y" | "2y" | "custom";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const rankLabel = (type: "dad" | "son", rank: number): string => {
  if (type === "dad") {
    return rank === 1 ? "大爹" : rank === 2 ? "二爹" : "三爹";
  }
  return rank === 1 ? "亲儿子" : rank === 2 ? "二儿子" : "三儿子";
};

export default function RankingView({
  playerId,
  initialType = "son",
  initialMinGames = 10,
  initialFrom,
  initialTo,
}: Props) {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [type, setType] = useState<"dad" | "son">(initialType);
  const [minGames, setMinGames] = useState(initialMinGames);
  const [preset, setPreset] = useState<Preset>(
    initialFrom || initialTo ? "custom" : "all"
  );
  const [customFrom, setCustomFrom] = useState(initialFrom ?? "");
  const [customTo, setCustomTo] = useState(initialTo ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setEntries([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/players?id=${playerId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setPlayer(json.player ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const effective = useMemo(() => {
    if (preset === "1y") return { from: daysAgo(365), to: "" };
    if (preset === "2y") return { from: daysAgo(730), to: "" };
    if (preset === "custom") return { from: customFrom, to: customTo };
    return { from: "", to: "" };
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        player: String(playerId),
        type,
        min_games: String(minGames),
      });
      const { from, to } = effective;
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/rankings?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "查询失败");
        return;
      }
      setEntries(Array.isArray(json.entries) ? json.entries : []);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [playerId, type, minGames, effective]);

  useEffect(() => {
    load();
    const { from, to } = effective;
    const params = new URLSearchParams({ type });
    params.set("min_games", String(minGames));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.replace(`/ranking/${playerId}?${params.toString()}`, { scroll: false });
  }, [load, type, minGames, effective, playerId, router]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="container">
      <h1 className="page-title">爹榜 / 儿榜</h1>
      <p className="page-sub">
        选一名选手，看看谁是压着他的爹、谁又是他随手拿捏的儿。
      </p>

      <div style={{ maxWidth: 560, marginBottom: 22 }}>
        <PlayerAutocomplete
          value={player}
          onSelect={(p) => {
            if (p) {
              router.push(`/ranking/${p.id}?type=${type}&min_games=${minGames}`);
            }
          }}
          placeholder="输入选手 ID，如 Bin"
        />
      </div>

      {playerId && player && (
        <div className="toolbar">
          <div className="seg">
            <button
              className={type === "dad" ? "active" : ""}
              onClick={() => setType("dad")}
            >
              爹榜（谁是他爹）
            </button>
            <button
              className={type === "son" ? "active" : ""}
              onClick={() => setType("son")}
            >
              儿榜（谁是他儿）
            </button>
          </div>
          <div className="presets">
            <label style={{ color: "var(--muted)", fontSize: 13 }}>
              最少交手{" "}
              <select
                value={minGames}
                onChange={(e) => setMinGames(Number(e.target.value))}
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 8px",
                }}
              >
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} 局
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`preset ${preset === "all" ? "active" : ""}`}
              onClick={() => setPreset("all")}
            >
              全部
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
      )}

      {loading && (
        <div className="loading">
          <span className="spinner" />
          正在盘点父子关系…
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {!loading && !error && playerId && player && (
        <>
          <h2 className="section-title" style={{ marginTop: 10 }}>
            {player.name}
            {type === "dad" ? " 的爹榜" : " 的儿榜"}
          </h2>
          <p className="section-desc">
            {type === "dad"
              ? `按 ${player.name} 面对对手的胜率从低到高排序，胜率越低说明对方越像爹。`
              : `按 ${player.name} 面对对手的胜率从高到低排序，胜率越高说明对方越像儿。`}
          </p>

          {entries.length === 0 ? (
            <div className="empty-box">
              该条件下暂无足够样本的对手，试试调低「最少交手局数」。
            </div>
          ) : (
            <>
              <div className="rank-cards">
                {top3.map((e) => (
                  <div key={e.player.id} className={`rank-card rank-${e.rank}`}>
                    <div className="rank-label">
                      {type === "dad" ? `爹位 #${e.rank}` : `儿位 #${e.rank}`}
                    </div>
                    <div className="rank-name">{e.player.name}</div>
                    <div className="rank-sub">
                      {type === "dad" ? (
                        <>
                          <strong>{e.player.name}</strong> 是 {player.name} 的{" "}
                          {rankLabel("dad", e.rank)}
                          <br />
                          {player.name} 对位胜率 {pct(e.pWinRate)}（
                          {e.pWins} 胜 {e.games - e.pWins} 负 · {e.games} 局）
                        </>
                      ) : (
                        <>
                          <strong>{e.player.name}</strong> 是 {player.name} 的{" "}
                          {rankLabel("son", e.rank)}
                          <br />
                          {player.name} 对位胜率 {pct(e.pWinRate)}（
                          {e.pWins} 胜 {e.games - e.pWins} 负 · {e.games} 局）
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>对手</th>
                      <th>交手局数</th>
                      <th>胜率</th>
                      <th>系列赛</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...top3, ...rest].map((e) => (
                      <tr key={e.player.id}>
                        <td>{e.rank}</td>
                        <td>
                          <strong>{e.player.name}</strong>
                          {e.player.teams.length
                            ? `（${e.player.teams.slice(0, 2).join(" · ")}）`
                            : ""}
                        </td>
                        <td>{e.games}</td>
                        <td>
                          <span className={e.pWinRate >= 0.5 ? "win-a" : "win-b"}>
                            {pct(e.pWinRate)}
                          </span>
                          <span style={{ color: "var(--muted)" }}>
                            {" "}
                            ({e.pWins}-{e.games - e.pWins})
                          </span>
                        </td>
                        <td>
                          {e.series} 个系列 · {player.name} 赢 {e.pSeriesWins}
                        </td>
                        <td>
                          <Link
                            className="btn btn-sm"
                            href={`/h2h/${playerId}/${e.player.id}`}
                          >
                            查看交手
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {!playerId && (
        <div className="empty-box">
          在上方输入一名选手，即可查看他的爹榜与儿榜。
        </div>
      )}
    </div>
  );
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
