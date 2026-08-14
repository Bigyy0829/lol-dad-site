#!/usr/bin/env python3
"""Build 2018 Asian Games main-event data into an OE-format CSV.

Leaguepedia has the 2018 AG main event only as MatchSchedule rows (teams,
dates, series scores) plus team rosters -- there are no per-game scoreboards
(no champion picks). We reconstruct per-game results from contemporary match
reports, use the documented starting lineups, and record champion as empty.

Known per-game results (verified from 2018 press coverage):
  Semifinal  CT 1-2 China       : CT, China, China
  Semifinal  Korea 2-0 Saudi    : Korea, Korea
  3rd place  Saudi 1-3 CT       : Saudi, CT, CT, CT
  Final      Korea 1-3 China    : China, Korea, China, China
  (Korea used jungler Peanut in final game 4; Score started games 1-3.)

gameid/matchid follow the convention used by the events pipeline:
matchid = "2018 Asian Games_<Tab>_<N_MatchInTab>" and gameid appends the
game number (e.g. "2018 Asian Games_Finals_1_2"). playoffs is 0 for every
row, matching how Leaguepedia marks national-team events (all existing
Asian Games rows in the events CSV are playoffs=0); series grouping in
build_db.py still separates group-stage matches from knockout series via
date + game-number resets.

Output: data/raw/ag2018_main_LoL_esports_match_data_from_OraclesElixir.csv
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw")
CACHE = os.path.join(ROOT, "tmp", "ag2018_ms.json")

PROXY = "http://127.0.0.1:7890"
PROXIES = {"http": PROXY, "https": PROXY}
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA}

OE_COLUMNS = [
    "gameid", "matchid", "league", "split", "playoffs", "date", "game",
    "side", "position", "player", "team", "champion", "result",
]

# Starting lineups (position from TeamRoster role letters t/j/m/a/s).
# Subs (e.g. Korea Peanut, China Ming) are excluded except where documented.
ROSTERS = {
    "China (National Team)": [
        ("Letme", "TOP"), ("Mlxg", "JUNGLE"), ("Xiye", "MID"),
        ("Uzi (Jian Zi-Hao)", "BOT"), ("Meiko", "SUP"),
    ],
    "South Korea (National Team)": [
        ("Kiin", "TOP"), ("Score", "JUNGLE"), ("Faker", "MID"),
        ("Ruler", "BOT"), ("CoreJJ", "SUP"),
    ],
    "Chinese Taipei (National Team)": [
        ("PK", "TOP"), ("BAYBAY", "JUNGLE"), ("Maple (Huang Yi-Tang)", "MID"),
        ("Betty", "BOT"), ("SwordArT", "SUP"),
    ],
    "Saudi Arabia (National Team)": [
        ("Wickychi", "TOP"), ("Ajwad", "JUNGLE"), ("Fear (Maan Arshad)", "MID"),
        ("Mimic (Nawaf Al-Salem)", "BOT"), ("Mishal", "SUP"),
    ],
    "Vietnam (National Team)": [
        ("Stark (Phan Công Minh)", "TOP"), ("Yi Jin", "JUNGLE"),
        ("Warzone", "MID"), ("Slay", "BOT"), ("RonOP", "SUP"),
    ],
    "Pakistan (National Team)": [
        ("YasugaKazama", "TOP"), ("Deep Vision", "JUNGLE"),
        ("ToxicAndUgly", "MID"), ("JisatsuCarry", "BOT"), ("Zen San", "SUP"),
    ],
    "Indonesia (National Team)": [
        ("FakeFriends", "TOP"), ("Fong", "JUNGLE"), ("Whynuts", "MID"),
        ("AirLiur", "BOT"), ("Potato (Gerry Arisena)", "SUP"),
    ],
    "Kazakhstan (National Team)": [
        ("BulaXOXO", "TOP"), ("Synns", "JUNGLE"), ("Crayon (Kazakhstan)", "MID"),
        ("Fakelover", "BOT"), ("Milky (Kazakhstan)", "SUP"),
    ],
}

# Korea used Peanut as jungler in final game 4 (documented in press).
PEANUT_FINAL_GAME = {"South Korea (National Team)": [
    ("Kiin", "TOP"), ("Peanut", "JUNGLE"), ("Faker", "MID"),
    ("Ruler", "BOT"), ("CoreJJ", "SUP"),
]}

# (Team1, Team2, Tab) -> per-game winners in order.
SERIES_ORDER = {
    ("Chinese Taipei (National Team)", "China (National Team)", "Semifinals"):
        ["Chinese Taipei (National Team)", "China (National Team)", "China (National Team)"],
    ("South Korea (National Team)", "Saudi Arabia (National Team)", "Semifinals"):
        ["South Korea (National Team)", "South Korea (National Team)"],
    ("Saudi Arabia (National Team)", "Chinese Taipei (National Team)", "Third-Place Match"):
        ["Saudi Arabia (National Team)", "Chinese Taipei (National Team)",
         "Chinese Taipei (National Team)", "Chinese Taipei (National Team)"],
    ("South Korea (National Team)", "China (National Team)", "Finals"):
        ["China (National Team)", "South Korea (National Team)",
         "China (National Team)", "China (National Team)"],
}


def fetch_matches(refresh=False):
    if not refresh and os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    url = "https://lol.fandom.com/wiki/Special:CargoExport"
    params = {
        "tables": "MatchSchedule",
        "fields": ("Team1,Team2,Team1Score,Team2Score,Winner,DateTime_UTC,"
                   "BestOf,Tab,N_MatchInTab"),
        "where": "OverviewPage = '2018 Asian Games'",
        "format": "csv",
        "limit": 2000,
    }
    last = None
    for i in range(6):
        try:
            r = requests.get(url, params=params, headers=HEADERS,
                             proxies=PROXIES, timeout=90)
            raw = r.content
            txt = raw.decode("utf-16", "replace") if raw[:2] in (
                b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8", "replace")
            if r.status_code == 200 and "<html" not in txt[:100].lower():
                rows = list(csv.DictReader(io.StringIO(txt)))
                out = []
                for row in rows:
                    out.append({k.replace(" ", "_"): v
                                for k, v in row.items()
                                if not k.replace(" ", "_").endswith("__precision")})
                os.makedirs(os.path.dirname(CACHE), exist_ok=True)
                with open(CACHE, "w", encoding="utf-8") as f:
                    json.dump(out, f, ensure_ascii=False)
                return out
        except Exception as e:  # noqa: BLE001
            last = repr(e)
            time.sleep(4 * (i + 1))
    raise RuntimeError(f"failed to fetch MatchSchedule: {last}")


def main():
    refresh = "--refresh" in sys.argv
    matches = fetch_matches(refresh)
    print(f"{len(matches)} matches loaded from MatchSchedule")

    rows_out = []
    for m in matches:
        t1 = (m.get("Team1") or "").strip()
        t2 = (m.get("Team2") or "").strip()
        tab = (m.get("Tab") or "").strip()
        date = (m.get("DateTime_UTC") or "")[:10]
        bestof = int((m.get("BestOf") or "1").strip() or 1)
        n_in_tab = (m.get("N_MatchInTab") or "").strip()

        if bestof == 1:
            winners = [t1 if (m.get("Winner") or "").strip() == "1" else t2]
        else:
            key = (t1, t2, tab)
            winners = SERIES_ORDER.get(key)
            if not winners:
                print(f"  WARNING: no per-game order for {key}, skipping")
                continue

        for gno, winner in enumerate(winners, start=1):
            mid = f"2018 Asian Games_{tab}_{n_in_tab}"
            gid = f"{mid}_{gno}"
            for team, side in ((t1, "Blue"), (t2, "Red")):
                roster = ROSTERS.get(team)
                if team == "South Korea (National Team)" and gno == 4 and tab == "Finals":
                    roster = PEANUT_FINAL_GAME.get(team)
                if not roster:
                    print(f"  WARNING: no roster for {team}, skipping")
                    continue
                result = 1 if team == winner else 0
                for player, pos in roster:
                    rows_out.append({
                        "gameid": gid,
                        "matchid": mid,
                        "league": "Asian Games",
                        "split": "",
                        "playoffs": 0,
                        "date": date,
                        "game": gno,
                        "side": side,
                        "position": pos,
                        "player": player,
                        "team": team,
                        "champion": "",
                        "result": result,
                    })

    path = os.path.join(
        RAW_DIR, "ag2018_main_LoL_esports_match_data_from_OraclesElixir.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OE_COLUMNS)
        w.writeheader()
        w.writerows(rows_out)
    games = len({r["gameid"] for r in rows_out})
    print(f"{path}: {len(rows_out):,} player rows across {games} games")


if __name__ == "__main__":
    main()
