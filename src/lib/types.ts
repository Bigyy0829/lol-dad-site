export interface Player {
  id: number;
  name: string;
  norm: string;
  positions: string[];
  teams: string[];
  lastTeam: string;
  firstYear: string;
  lastYear: string;
  games: number;
  aliases: string[];
}

export interface MatchGame {
  gameId: string;
  matchId: string;
  date: string;
  league: string;
  split: string;
  playoffs: boolean;
  gameNumber: string;
  blueTeam: string;
  redTeam: string;
  blueWin: boolean | null;
  aSide: "Blue" | "Red";
  aTeam: string;
  aChampion: string;
  aResult: number;
  bSide: "Blue" | "Red";
  bTeam: string;
  bChampion: string;
  bResult: number;
}

export interface MatchSeries {
  matchId: string;
  date: string;
  league: string;
  split: string;
  playoffs: boolean;
  aTeam: string;
  bTeam: string;
  aGames: number;
  bGames: number;
  winner: "a" | "b";
}

export interface H2hSummary {
  games: number;
  aWins: number;
  bWins: number;
  aWinRate: number;
  bWinRate: number;
  series: number;
  aSeriesWins: number;
  bSeriesWins: number;
  aSeriesWinRate: number;
  bSeriesWinRate: number;
  firstDate: string;
  lastDate: string;
}

export interface H2hData {
  a: Player;
  b: Player;
  summary: H2hSummary;
  games: MatchGame[];
  series: MatchSeries[];
}

export interface RankingEntry {
  rank: number;
  player: Player;
  games: number;
  pWins: number;
  pWinRate: number;
  series: number;
  pSeriesWins: number;
  pSeriesWinRate: number;
}
