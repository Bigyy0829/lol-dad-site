import { describe, expect, it } from "vitest";
import { verdict } from "./verdict";

const base = {
  aName: "Bin",
  bName: "Zeus",
  games: 20,
  aWins: 14,
  bWins: 6,
  series: 4,
  aSeriesWins: 3,
  bSeriesWins: 1,
};

describe("verdict", () => {
  it("declares A the dad at >= 60% win rate", () => {
    const v = verdict(base);
    expect(v.direction).toBe("a");
    expect(v.title).toContain("Bin 是 Zeus 的爹");
    expect(v.aWinRate).toBe(0.7);
  });

  it("declares A a soft dad at 55-60%", () => {
    const v = verdict({ ...base, aWins: 11, bWins: 9 });
    expect(v.direction).toBe("a");
    expect(v.title).toContain("略占上风");
  });

  it("declares a tie between 45-55%", () => {
    const v = verdict({ ...base, aWins: 10, bWins: 10 });
    expect(v.direction).toBe("tie");
    expect(v.title).toContain("互为兄弟");
  });

  it("declares exact 50% as nobody yields", () => {
    const v = verdict({ ...base, aWins: 10, bWins: 10 });
    expect(v.subtitle).toContain("五五开");
  });

  it("declares B the dad when A is below 40%", () => {
    const v = verdict({ ...base, aWins: 6, bWins: 14 });
    expect(v.direction).toBe("b");
    expect(v.title).toContain("Zeus 是 Bin 的爹");
  });

  it("declares B a soft dad at 40-45%", () => {
    const v = verdict({ ...base, aWins: 9, bWins: 11 });
    expect(v.direction).toBe("b");
    expect(v.title).toContain("略占上风");
  });

  it("marks insufficient sample below minGames", () => {
    const v = verdict({ ...base, games: 4, aWins: 3, bWins: 1 });
    expect(v.direction).toBe("insufficient");
    expect(v.title).toContain("样本不足");
  });

  it("handles no games", () => {
    const v = verdict({ ...base, games: 0, aWins: 0, bWins: 0 });
    expect(v.direction).toBe("none");
    expect(v.title).toContain("没有交过手");
  });

  it("handles same player", () => {
    const v = verdict({ ...base, samePlayer: true, games: 0, aWins: 0, bWins: 0 });
    expect(v.direction).toBe("same");
  });

  it("mentions series edge when games are close but series are lopsided", () => {
    const v = verdict({
      ...base,
      aWins: 10,
      bWins: 10,
      series: 3,
      aSeriesWins: 3,
      bSeriesWins: 0,
    });
    expect(v.subtitle).toContain("系列赛 3-0");
  });

  it("respects custom minGames", () => {
    const v = verdict({ ...base, games: 8, aWins: 6, bWins: 2, minGames: 5 });
    expect(v.direction).toBe("a");
  });
});
