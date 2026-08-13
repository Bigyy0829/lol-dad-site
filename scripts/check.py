#!/usr/bin/env python3
"""Quick verification CLI: print head-to-head stats for two players."""

import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "data", "lol.db")


def find_players(cur, names):
    out = []
    for name in names:
        norm = name.strip().lower()
        row = cur.execute(
            "SELECT id, name, games FROM players WHERE norm LIKE ? ORDER BY games DESC LIMIT 5",
            (f"%{norm}%",),
        ).fetchall()
        if not row:
            print(f"Not found: {name}")
            sys.exit(1)
        exact = next((r for r in row if r[1].lower() == norm), None)
        out.append(exact or row[0])
    return out


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/check.py <playerA> <playerB>")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    a, b = find_players(cur, sys.argv[1:3])
    print(f"{a[1]} (id={a[0]}) vs {b[1]} (id={b[0]})")

    pair = cur.execute(
        """SELECT games, a_wins, b_wins, series, a_series_wins, b_series_wins,
                  first_date, last_date
           FROM h2h WHERE (player_a_id=? AND player_b_id=?) OR (player_a_id=? AND player_b_id=?)""",
        (a[0], b[0], b[0], a[0]),
    ).fetchone()
    if pair:
        games, aw, bw, series, asw, bsw, first, last = pair
        if a[0] > b[0]:
            aw, bw = bw, aw
            asw, bsw = bsw, asw
        print(f"Games: {games} ({aw}-{bw})  Series: {series} ({asw}-{bsw})")
        print(f"Period: {first} ~ {last}")
    else:
        print("No head-to-head games found.")

    print("\nLatest games:")
    rows = cur.execute(
        """SELECT g.date, g.league, g.split, g.playoffs, g.blue_team, g.red_team,
                  g.blue_win, mp1.team, mp1.champion, mp2.champion
           FROM match_players mp1
           JOIN match_players mp2 ON mp2.game_id = mp1.game_id
           JOIN games g ON g.id = mp1.game_id
           WHERE mp1.player_id=? AND mp2.player_id=? AND mp1.team != mp2.team
           ORDER BY g.date DESC, g.gameid DESC LIMIT 8""",
        (a[0], b[0]),
    ).fetchall()
    for r in rows:
        date, league, split, playoffs, bt, rt, bw, team, ca, cb = r
        print(
            f"  {date} [{league}{(' '+split) if split else ''}{' PO' if playoffs else ''}] "
            f"{bt} vs {rt} | {ca} vs {cb} | {team} {'W' if (bw == 1 and team == bt) or (bw == 0 and team == rt) else 'L'}"
        )
    conn.close()


if __name__ == "__main__":
    main()
