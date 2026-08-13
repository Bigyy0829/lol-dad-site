export type VerdictDirection = "a" | "b" | "tie" | "same" | "none" | "insufficient";

export interface VerdictInput {
  aName: string;
  bName: string;
  samePlayer?: boolean;
  games: number;
  aWins: number;
  bWins: number;
  series: number;
  aSeriesWins: number;
  bSeriesWins: number;
  minGames?: number;
}

export interface Verdict {
  direction: VerdictDirection;
  title: string;
  subtitle: string;
  aWinRate: number;
  bWinRate: number;
}

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

export function verdict(input: VerdictInput): Verdict {
  const minGames = input.minGames ?? 10;
  const { aName, bName, games, aWins, bWins } = input;
  const aWinRate = games > 0 ? aWins / games : 0;
  const bWinRate = games > 0 ? bWins / games : 0;
  const seriesNote =
    input.series >= 2 && input.aSeriesWins !== input.bSeriesWins
      ? `系列赛 ${input.aSeriesWins}-${input.bSeriesWins}，${input.aSeriesWins > input.bSeriesWins ? aName : bName} 占优`
      : "";

  if (input.samePlayer) {
    return {
      direction: "same",
      title: `${aName} 打自己？禁止左右互搏`,
      subtitle: "父子局必须找别人打，自己和自己不算数。",
      aWinRate,
      bWinRate,
    };
  }

  if (games === 0) {
    return {
      direction: "none",
      title: `${aName} 与 ${bName} 至今没有交过手`,
      subtitle: "没有对战记录，父子关系暂时无法鉴定。",
      aWinRate,
      bWinRate,
    };
  }

  const stats = `小局 ${aWins}胜${bWins}负（胜率 ${pct(aWinRate)}）${seriesNote ? "，" + seriesNote : ""}`;

  if (games < minGames) {
    return {
      direction: "insufficient",
      title: `样本不足：${aName} 和 ${bName} 的父子关系待定`,
      subtitle: `两人只交手 ${games} 局，证据不够硬，先别急着认爹。${stats}`,
      aWinRate,
      bWinRate,
    };
  }

  if (aWinRate >= 0.6) {
    return {
      direction: "a",
      title: `${aName} 是 ${bName} 的爹 👑`,
      subtitle: `按小局胜率 ${pct(aWinRate)}，${aName} 稳稳拿捏 ${bName}。${stats}`,
      aWinRate,
      bWinRate,
    };
  }
  if (aWinRate >= 0.55) {
    return {
      direction: "a",
      title: `${aName} 略占上风，勉强算 ${bName} 的爹`,
      subtitle: `胜率 ${pct(aWinRate)}，差一点就不是了，${bName} 好好努力还有救。${stats}`,
      aWinRate,
      bWinRate,
    };
  }
  if (aWinRate > 0.45) {
    return {
      direction: "tie",
      title: `势均力敌：${aName} 与 ${bName} 互为兄弟 🤝`,
      subtitle: aWinRate === 0.5
        ? `胜率五五开，谁也不服谁。${stats}`
        : `胜率 ${pct(aWinRate)}，谁也压不住谁。${stats}`,
      aWinRate,
      bWinRate,
    };
  }
  if (aWinRate > 0.4) {
    return {
      direction: "b",
      title: `${bName} 略占上风，勉强算 ${aName} 的爹`,
      subtitle: `${aName} 胜率仅 ${pct(aWinRate)}，${bName} 差一点就是爹了。${stats}`,
      aWinRate,
      bWinRate,
    };
  }
  return {
    direction: "b",
    title: `${bName} 是 ${aName} 的爹 👑`,
    subtitle: `按小局胜率 ${pct(bWinRate)}，${bName} 稳稳拿捏 ${aName}。${stats}`,
    aWinRate,
    bWinRate,
  };
}
