#!/usr/bin/env python3
"""Diagnose data coverage: per-year date ranges and key matchups."""

import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "lol.db")


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    print("=== per-year coverage ===")
    for r in cur.execute(
        "SELECT year, COUNT(*), MIN(date), MAX(date) FROM games GROUP BY year ORDER BY year"
    ):
        print(f"  {r[0]}: {r[1]:,} games, {r[2]} ~ {r[3]}")

    def pid(name):
        row = conn.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone()
        if not row:
            raise SystemExit(f"player not found: {name}")
        return row[0]

    pairs = [
        ("Bin", "Zeus", pid("Bin"), pid("Zeus")),
        ("Bin", "Faker", pid("Bin"), pid("Faker")),
    ]
    for label, _, a, b in pairs:
        print(f"=== {label} by year ===")
        rows = cur.execute(
            """
            SELECT substr(g.date,1,4) y, COUNT(*), SUM(mp1.result)
            FROM match_players mp1
            JOIN match_players mp2 ON mp2.game_id = mp1.game_id
            JOIN games g ON g.id = mp1.game_id
            WHERE mp1.player_id=? AND mp2.player_id=? AND mp1.team != mp2.team
            GROUP BY y ORDER BY y
            """,
            (a, b),
        ).fetchall()
        for r in rows:
            print(f"  {r[0]}: {r[1]} games ({r[2]} wins)")
        if not rows:
            print("  (none)")

    print("=== 2025 HLE vs Bilibili Gaming ===")
    rows = cur.execute(
        """
        SELECT g.date, g.league, g.blue_team, g.red_team
        FROM games g
        WHERE g.year='2025'
          AND ((g.blue_team LIKE '%Hanwha%' AND g.red_team LIKE '%Bilibili%')
            OR (g.blue_team LIKE '%Bilibili%' AND g.red_team LIKE '%Hanwha%'))
        ORDER BY g.date
        """
    ).fetchall()
    print(rows if rows else "  (none)")

    print("=== 2025 league coverage (top 15) ===")
    for r in cur.execute(
        "SELECT league, COUNT(*) FROM games WHERE year='2025' GROUP BY league ORDER BY COUNT(*) DESC LIMIT 15"
    ):
        print(f"  {r[0]}: {r[1]}")

    print("=== key events coverage ===")
    for league in ("MSI", "WLDs", "EWC"):
        n = cur.execute(
            "SELECT COUNT(*) FROM games WHERE year='2025' AND league=?", (league,)
        ).fetchone()[0]
        print(f"  2025 {league}: {n} games")
    print("  2026 leagues:", [r[0] for r in cur.execute(
        "SELECT DISTINCT league FROM games WHERE year='2026' ORDER BY league"
    )])

    conn.close()


if __name__ == "__main__":
    main()
