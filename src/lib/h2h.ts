import { getDb } from "./db";
import type {
  H2hData,
  H2hSummary,
  MatchGame,
  MatchSeries,
  Player,
  RankingEntry,
} from "./types";

const DEFAULT_FROM = "0001-01-01";
const DEFAULT_TO = "9999-12-31";

interface PlayerRow {
  id: number;
  name: string;
  norm: string;
  positions: string;
  teams: string;
  last_team: string;
  first_year: string;
  last_year: string;
  games: number;
}

function toPlayer(row: PlayerRow, aliases: string[]): Player {
  return {
    id: row.id,
    name: row.name,
    norm: row.norm,
    positions: JSON.parse(row.positions || "[]") as string[],
    teams: JSON.parse(row.teams || "[]") as string[],
    lastTeam: row.last_team,
    firstYear: row.first_year,
    lastYear: row.last_year,
    games: row.games,
    aliases,
  };
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/[^0-9a-z\u4e00-\u9fff]/g, "");
}

export function searchPlayers(q: string, limit = 20): Player[] {
  const norm = normalizeQuery(q);
  if (!norm) return [];
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.norm, p.positions, p.teams, p.last_team,
              p.first_year, p.last_year, p.games
       FROM players p
       LEFT JOIN aliases a ON a.player_id = p.id
       WHERE p.norm LIKE ? OR a.alias_norm LIKE ?
       ORDER BY p.games DESC
       LIMIT ?`
    )
    .all(`%${norm}%`, `%${norm}%`, limit) as PlayerRow[];
  return rows.map((r) => toPlayer(r, getAliases(r.id)));
}

function getAliases(playerId: number): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT alias FROM aliases WHERE player_id = ? ORDER BY alias LIMIT 12")
    .all(playerId) as { alias: string }[];
  return rows.map((r) => r.alias);
}

export function getPlayer(id: number): Player | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, norm, positions, teams, last_team, first_year, last_year, games
       FROM players WHERE id = ?`
    )
    .get(id) as PlayerRow | undefined;
  if (!row) return null;
  return toPlayer(row, getAliases(id));
}

export function getPlayerByExactName(name: string): Player | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, norm, positions, teams, last_team, first_year, last_year, games
       FROM players WHERE norm = ?`
    )
    .get(normalizeQuery(name)) as PlayerRow | undefined;
  if (!row) return null;
  return toPlayer(row, getAliases(row.id));
}

export function getH2h(
  aId: number,
  bId: number,
  from?: string,
  to?: string
): H2hData {
  const a = getPlayer(aId);
  const b = getPlayer(bId);
  if (!a || !b) {
    throw new Error("player not found");
  }
  const db = getDb();
  const fromDate = from || DEFAULT_FROM;
  const toDate = to || DEFAULT_TO;

  // "全部历史" includes games whose date is unknown (empty string).
  // Only apply the date window when the user actually asked for one.
  const whereClause = from || to ? "WHERE g.date BETWEEN ? AND ?" : "";
  const params: unknown[] = [aId, bId];
  if (from || to) {
    params.push(fromDate, toDate);
  }

  const rows = db
    .prepare(
      `SELECT g.gameid, g.matchid, g.date, g.league, g.split, g.playoffs,
              g.game_number, g.blue_team, g.red_team, g.blue_win,
              mp1.side AS a_side, mp1.team AS a_team, mp1.champion AS a_champion,
              mp1.result AS a_result,
              mp2.side AS b_side, mp2.team AS b_team, mp2.champion AS b_champion,
              mp2.result AS b_result
       FROM match_players mp1
       JOIN match_players mp2
         ON mp2.game_id = mp1.game_id
        AND mp1.player_id = ?
        AND mp2.player_id = ?
        AND mp1.team != mp2.team
       JOIN games g ON g.id = mp1.game_id
       ${whereClause}
       ORDER BY CASE WHEN g.date = '' THEN 1 ELSE 0 END, g.date ASC, g.gameid ASC`
    )
    .all(...params) as Array<{
    gameid: string;
    matchid: string;
    date: string;
    league: string;
    split: string;
    playoffs: number;
    game_number: string;
    blue_team: string;
    red_team: string;
    blue_win: number | null;
    a_side: string;
    a_team: string;
    a_champion: string;
    a_result: number;
    b_side: string;
    b_team: string;
    b_champion: string;
    b_result: number;
  }>;

  const games: MatchGame[] = rows.map((r) => ({
    gameId: r.gameid,
    matchId: r.matchid,
    date: r.date,
    league: r.league,
    split: r.split,
    playoffs: !!r.playoffs,
    gameNumber: r.game_number,
    blueTeam: r.blue_team,
    redTeam: r.red_team,
    blueWin: r.blue_win === null ? null : !!r.blue_win,
    aSide: r.a_side === "Red" ? "Red" : "Blue",
    aTeam: r.a_team,
    aChampion: r.a_champion,
    aResult: r.a_result,
    bSide: r.b_side === "Red" ? "Red" : "Blue",
    bTeam: r.b_team,
    bChampion: r.b_champion,
    bResult: r.b_result,
  }));

  const seriesMap = new Map<string, MatchSeries>();
  for (const g of games) {
    let s = seriesMap.get(g.matchId);
    if (!s) {
      s = {
        matchId: g.matchId,
        date: g.date,
        league: g.league,
        split: g.split,
        playoffs: g.playoffs,
        aTeam: g.aTeam,
        bTeam: g.bTeam,
        aGames: 0,
        bGames: 0,
        winner: "a",
      };
      seriesMap.set(g.matchId, s);
    }
    if (g.aResult === 1) s.aGames += 1;
    if (g.bResult === 1) s.bGames += 1;
  }
  const series = [...seriesMap.values()].map((s) => ({
    ...s,
    winner:
      s.aGames > s.bGames
        ? ("a" as const)
        : s.bGames > s.aGames
          ? ("b" as const)
          : ("a" as const),
  }));

  const aWins = games.filter((g) => g.aResult === 1).length;
  const bWins = games.length - aWins;
  const aSeriesWins = series.filter((s) => s.winner === "a").length;
  const bSeriesWins = series.filter((s) => s.winner === "b").length;

  const summary: H2hSummary = {
    games: games.length,
    aWins,
    bWins,
    aWinRate: games.length ? aWins / games.length : 0,
    bWinRate: games.length ? bWins / games.length : 0,
    series: series.length,
    aSeriesWins,
    bSeriesWins,
    aSeriesWinRate: series.length ? aSeriesWins / series.length : 0,
    bSeriesWinRate: series.length ? bSeriesWins / series.length : 0,
    firstDate: games.find((g) => g.date)?.date ?? "",
    lastDate: [...games].reverse().find((g) => g.date)?.date ?? "",
  };

  return { a, b, summary, games, series };
}

export function getRankings(
  playerId: number,
  type: "dad" | "son",
  minGames: number,
  from?: string,
  to?: string,
  limit = 30
): { player: Player; entries: RankingEntry[] } {
  const player = getPlayer(playerId);
  if (!player) {
    throw new Error("player not found");
  }
  const db = getDb();
  const fromDate = from || DEFAULT_FROM;
  const toDate = to || DEFAULT_TO;

  // Same rule as getH2h: "全部历史" includes unknown-date games.
  const dateClause = from || to ? "AND g.date BETWEEN ? AND ?" : "";
  const params: unknown[] = [playerId];
  if (from || to) {
    params.push(fromDate, toDate);
  }

  const rows = db
    .prepare(
      `SELECT mp2.player_id AS oid, g.matchid AS mid,
              COUNT(*) AS games, SUM(mp1.result) AS p_wins
       FROM match_players mp1
       JOIN match_players mp2
         ON mp2.game_id = mp1.game_id
         AND mp2.player_id != mp1.player_id
         AND mp1.team != mp2.team
       JOIN games g ON g.id = mp1.game_id
       WHERE mp1.player_id = ? ${dateClause}
       GROUP BY mp2.player_id, g.matchid`
    )
    .all(...params) as Array<{
    oid: number;
    mid: string;
    games: number;
    p_wins: number;
  }>;

  const agg = new Map<
    number,
    { games: number; pWins: number; series: number; pSeriesWins: number }
  >();
  for (const r of rows) {
    let e = agg.get(r.oid);
    if (!e) {
      e = { games: 0, pWins: 0, series: 0, pSeriesWins: 0 };
      agg.set(r.oid, e);
    }
    e.games += r.games;
    e.pWins += r.p_wins;
    e.series += 1;
    if (r.p_wins * 2 > r.games) e.pSeriesWins += 1;
  }

  const ids = [...agg.keys()];
  const nameMap = new Map<number, Player>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const rows2 = db
      .prepare(
        `SELECT id, name, norm, positions, teams, last_team, first_year, last_year, games
         FROM players WHERE id IN (${placeholders})`
      )
      .all(...ids) as PlayerRow[];
    for (const r of rows2) {
      nameMap.set(r.id, toPlayer(r, getAliases(r.id)));
    }
  }

  let entries: RankingEntry[] = [];
  for (const [oid, e] of agg) {
    if (e.games < minGames) continue;
    const opponent = nameMap.get(oid);
    if (!opponent) continue;
    entries.push({
      rank: 0,
      player: opponent,
      games: e.games,
      pWins: e.pWins,
      pWinRate: e.pWins / e.games,
      series: e.series,
      pSeriesWins: e.pSeriesWins,
      pSeriesWinRate: e.series ? e.pSeriesWins / e.series : 0,
    });
  }

  // dad = opponents who beat P the most (P's win rate ascending)
  // son = opponents P beats the most (P's win rate descending)
  entries.sort((x, y) => {
    const d =
      type === "dad"
        ? x.pWinRate - y.pWinRate
        : y.pWinRate - x.pWinRate;
    return d !== 0 ? d : y.games - x.games;
  });
  entries = entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));

  return { player, entries };
}
