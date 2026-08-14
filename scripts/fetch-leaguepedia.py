#!/usr/bin/env python3
"""Fetch missing 2011-2015 match data from Leaguepedia and write OE-format CSVs.

Why: Oracle's Elixir (OE) data starts at 2014 and only covers EU/NA/Worlds for
2014, and misses LPL in 2015. Leaguepedia (lol.fandom.com) Cargo tables have
player-level scoreboard data for 2011+. We fill:
  2011-2013: all tournaments (OE has nothing)
  2014     : everything except EU LCS / NA LCS / EU CS / NA CS / Worlds (OE covers those)
  2015     : LPL only (OE covers the rest)

Output: data/raw/<year>_leaguepedia_LoL_esports_match_data_from_OraclesElixir.csv
which build_db.py picks up via its glob pattern.

Usage:
  python scripts/fetch-leaguepedia.py            # fetch + build CSVs (cached)
  python scripts/fetch-leaguepedia.py --refresh  # refetch everything
"""

from __future__ import annotations

import csv
import html
import io
import json
import os
import sys
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw")
CACHE_DIR = os.path.join(ROOT, "tmp", "leaguepedia")

PROXY = "http://127.0.0.1:7890"
PROXIES = {"http": PROXY, "https": PROXY}
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA}

GAMES_FIELDS = ("GameId,MatchId,Tournament,Team1,Team2,WinTeam,DateTime_UTC,"
                "N_GameInMatch,OverviewPage,Patch,Winner")
TOURN_FIELDS = "Name,League,Region,Split,Year,IsPlayoffs,IsQualifier"
PLAYERS_FIELDS = "GameId,Link,Champion,Team,Side,Role"

# Leaguepedia League values already covered by OE per year -> exclude.
COVERED_2014 = {
    "Europe League Championship Series",      # EU LCS
    "North America League Championship Series",  # NA LCS
    "Europe Challenger Series",               # EU CS
    "North America Challenger Series",        # NA CS
    "World Championship",                     # WLDs
}
LPL_LEAGUE = "Tencent LoL Pro League"         # 2015: only LPL missing

LEAGUE_MAP = {
    "LoL The Champions": "LCK",
    "Champions Korea": "LCK",
    "Tencent LoL Pro League": "LPL",
    "Garena Premier League": "LMS",
    "World Championship": "WLDs",
    "Europe League Championship Series": "EU LCS",
    "North America League Championship Series": "NA LCS",
    "Europe Challenger Series": "EU CS",
    "North America Challenger Series": "NA CS",
    "All-Star 2014 Paris": "All-Star",
}

POS_MAP = {
    "Top": "TOP", "Jungle": "JUNGLE", "Mid": "MID",
    "Bot": "BOT", "ADC": "BOT", "AD": "BOT", "Bottom": "BOT",
    "Support": "SUP",
}

OE_COLUMNS = [
    "gameid", "matchid", "league", "split", "playoffs", "date", "game",
    "side", "position", "player", "team", "champion", "result",
]


def log(msg):
    print(msg, flush=True)


def norm_keys(row):
    """CargoExport CSV headers use spaces ('DateTime UTC'); normalize to
    underscore keys and drop __precision extras."""
    out = {}
    for k, v in row.items():
        kk = k.replace(" ", "_")
        if kk.endswith("__precision"):
            continue
        out[kk] = v
    return out


def cargo_export(table, fields, where, limit=2000, offset=0, tries=6):
    """Query Special:CargoExport, returning parsed rows (list of dicts)."""
    url = "https://lol.fandom.com/wiki/Special:CargoExport"
    params = {
        "tables": table,
        "fields": fields,
        "where": where,
        "format": "csv",
        "limit": limit,
        "offset": offset,
    }
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=HEADERS,
                             proxies=PROXIES, timeout=120)
            raw = r.content
            if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
                text = raw.decode("utf-16", errors="replace")
            else:
                text = raw.decode("utf-8", errors="replace")
            if r.status_code != 200 or "<html" in text[:200].lower():
                last = f"HTTP {r.status_code}"
                time.sleep(5)
                continue
            reader = csv.DictReader(io.StringIO(text))
            out = []
            for row in reader:
                out.append(norm_keys(row))
            return out
        except Exception as e:  # noqa: BLE001
            last = repr(e)
            time.sleep(4 * (i + 1))
    raise RuntimeError(f"cargo_export failed for {table}: {last}")


def fetch_games(refresh=False):
    cache = os.path.join(CACHE_DIR, "games.json")
    if not refresh and os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return json.load(f)
    rows = []
    offset = 0
    where = "DateTime_UTC >= '2011-01-01' AND DateTime_UTC < '2016-01-01'"
    while True:
        batch = cargo_export("ScoreboardGames", GAMES_FIELDS, where,
                             limit=2000, offset=offset)
        log(f"  games offset {offset}: {len(batch)} rows")
        rows.extend(batch)
        if len(batch) < 2000:
            break
        offset += 2000
        time.sleep(1.2)
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    return rows


def fetch_tournaments(game_rows, refresh=False):
    cache = os.path.join(CACHE_DIR, "tournaments.json")
    if not refresh and os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return json.load(f)
    rows = []
    names = sorted({(g.get("Tournament") or "").strip()
                    for g in game_rows if (g.get("Tournament") or "").strip()})
    log(f"  distinct tournament names referenced: {len(names)}")
    batch_size = 100
    for i in range(0, len(names), batch_size):
        chunk = names[i:i + batch_size]
        esc = "','".join(x.replace("'", "''") for x in chunk)
        where = f"Name IN ('{esc}')"
        batch = cargo_export("Tournaments", TOURN_FIELDS, where)
        rows.extend(batch)
        log(f"  tournaments {i + len(chunk)}/{len(names)} -> {len(batch)} rows")
        time.sleep(1.0)
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    return rows


def fetch_players(game_ids, refresh=False):
    """Fetch ScoreboardPlayers for the given game ids (batched IN queries)."""
    cache = os.path.join(CACHE_DIR, "players.json")
    if not refresh and os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return json.load(f)
    rows = []
    ids = sorted(set(game_ids))
    batch_size = 50
    for i in range(0, len(ids), batch_size):
        chunk = ids[i:i + batch_size]
        esc = "','".join(x.replace("'", "''") for x in chunk)
        where = f"GameId IN ('{esc}')"
        batch = cargo_export("ScoreboardPlayers", PLAYERS_FIELDS, where)
        rows.extend(batch)
        log(f"  players {i + len(chunk)}/{len(ids)} -> {len(batch)} rows")
        time.sleep(1.0)
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    return rows


def normalize_league(tourn_league):
    if not tourn_league:
        return ""
    return LEAGUE_MAP.get(tourn_league, tourn_league)


def keep_game(year, tourn_league):
    if year in ("2011", "2012", "2013"):
        return True
    if year == "2014":
        return tourn_league not in COVERED_2014
    if year == "2015":
        return tourn_league == LPL_LEAGUE
    return False


def build_csvs(games, tournaments, players):
    tourn = {}
    for t in tournaments:
        name = (t.get("Name") or "").strip()
        if name:
            tourn[name] = t

    players_by_game = {}
    for p in players:
        gid = p.get("GameId")
        if gid:
            players_by_game.setdefault(gid, []).append(p)

    # win lookup per game: WinTeam, else Winner (1=Team1, 2=Team2)
    games_out = []  # (year, row-dicts)
    kept = skipped_no_winner = skipped_no_players = 0
    for g in games:
        gid = g.get("GameId")
        tname = (g.get("Tournament") or "").strip()
        t = tourn.get(tname) or {}
        dt = (g.get("DateTime_UTC") or "").strip()
        date = dt[:10] if dt else ""
        year = date[:4] or (t.get("Year") or "")
        tourn_league = (t.get("League") or "").strip()
        if not keep_game(year, tourn_league):
            continue
        ps = players_by_game.get(gid)
        if not ps:
            skipped_no_players += 1
            continue
        win_team = (g.get("WinTeam") or "").strip()
        if not win_team:
            try:
                winner = int((g.get("Winner") or "").strip() or 0)
            except ValueError:
                winner = 0
            if winner == 1:
                win_team = (g.get("Team1") or "").strip()
            elif winner == 2:
                win_team = (g.get("Team2") or "").strip()
        if not win_team:
            skipped_no_winner += 1
            continue
        league = normalize_league(tourn_league)
        split = (t.get("Split") or "").strip()
        playoffs = 1 if ((t.get("IsPlayoffs") or "").strip() in ("1", "true", "True")
                         or (t.get("IsQualifier") or "").strip() in ("1", "true", "True")) else 0
        game_no = (g.get("N_GameInMatch") or "1").strip() or "1"
        matchid = (g.get("MatchId") or gid).strip()
        rows = []
        for p in ps:
            side_val = (p.get("Side") or "").strip()
            side = "Blue" if side_val == "1" else ("Red" if side_val == "2" else "")
            if not side:
                continue
            player = html.unescape((p.get("Link") or "").strip())
            if not player:
                continue
            champion = html.unescape((p.get("Champion") or "").strip())
            team = html.unescape((p.get("Team") or "").strip())
            role = (p.get("Role") or "").strip()
            position = POS_MAP.get(role, "UNK")
            result = 1 if team == win_team else 0
            rows.append({
                "gameid": gid,
                "matchid": matchid,
                "league": league,
                "split": split,
                "playoffs": playoffs,
                "date": date,
                "game": game_no,
                "side": side,
                "position": position,
                "player": player,
                "team": team,
                "champion": champion,
                "result": result,
            })
        if rows:
            games_out.append((year, rows))
            kept += 1

    log(f"kept games: {kept}, skipped no-winner: {skipped_no_winner}, "
        f"skipped no-players: {skipped_no_players}")

    by_year = {}
    for year, rows in games_out:
        by_year.setdefault(year, []).extend(rows)

    os.makedirs(RAW_DIR, exist_ok=True)
    total = 0
    for year in sorted(by_year):
        rows = by_year[year]
        path = os.path.join(
            RAW_DIR, f"{year}_leaguepedia_LoL_esports_match_data_from_OraclesElixir.csv")
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=OE_COLUMNS)
            w.writeheader()
            w.writerows(rows)
        total += len(rows)
        leagues = sorted({r["league"] for r in rows})
        log(f"{path}: {len(rows):,} player rows | leagues: {leagues}")
    log(f"TOTAL player rows written: {total:,}")


def main():
    refresh = "--refresh" in sys.argv
    build_only = "--build-only" in sys.argv
    os.makedirs(CACHE_DIR, exist_ok=True)
    if build_only:
        with open(os.path.join(CACHE_DIR, "games.json"), encoding="utf-8") as f:
            games = [norm_keys(r) for r in json.load(f)]
        with open(os.path.join(CACHE_DIR, "tournaments.json"), encoding="utf-8") as f:
            tournaments = [norm_keys(r) for r in json.load(f)]
        with open(os.path.join(CACHE_DIR, "players.json"), encoding="utf-8") as f:
            players = [norm_keys(r) for r in json.load(f)]
        log(f"cached: {len(games)} games, {len(tournaments)} tournaments, {len(players)} players")
    else:
        log("Fetching ScoreboardGames 2011-2015 ...")
        games = fetch_games(refresh)
        log(f"  {len(games)} games")
        log("Fetching Tournaments 2011-2015 ...")
        tournaments = fetch_tournaments(games, refresh)
        log(f"  {len(tournaments)} tournaments")
        gids = [g.get("GameId") for g in games if g.get("GameId")]
        log(f"Fetching ScoreboardPlayers for {len(gids)} games ...")
        players = fetch_players(gids, refresh)
        log(f"  {len(players)} player rows")
    build_csvs(games, tournaments, players)


if __name__ == "__main__":
    main()
