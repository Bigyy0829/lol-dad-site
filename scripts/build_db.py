#!/usr/bin/env python3
"""Build the SQLite database from Oracle's Elixir yearly CSVs.

Input : data/raw/*_LoL_esports_match_data_from_OraclesElixir.csv
Output: data/lol.db

Tables:
  players(id, name, norm, positions, teams, last_team, first_year, last_year, games)
  aliases(player_id, alias, alias_norm)
  games(id, gameid, matchid, date, year, league, split, playoffs, game_number,
        blue_team, red_team, blue_win)
  match_players(game_id, player_id, team, side, position, champion, result)
  h2h(player_a_id, player_b_id, games, a_wins, b_wins, series, a_series_wins,
      b_series_wins, first_date, last_date)  -- player_a_id < player_b_id
"""

from __future__ import annotations

import glob
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw")
DB_PATH = os.path.join(ROOT, "data", "lol.db")
ALIASES_PATH = os.path.join(ROOT, "scripts", "seed_aliases.json")

NEEDED_COLUMNS = [
    "gameid", "matchid", "league", "split", "playoffs", "date", "game",
    "side", "position", "player", "team", "champion", "result",
]

COLUMN_ALIASES = {
    "player": "playername",
    "team": "teamname",
}

_NORM_RE = re.compile(r"[^0-9a-z\u4e00-\u9fff]")


def norm_name(name: str) -> str:
    if name is None:
        return ""
    return _NORM_RE.sub("", str(name).lower())


def clean_date(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    s = str(value).strip()
    if not s:
        return ""
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    return s[:10]


def parse_bool(value) -> int:
    if value is None:
        return 0
    if isinstance(value, float) and pd.isna(value):
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    s = str(value).strip().lower()
    if s in {"true", "1", "playoffs", "playoff", "yes"}:
        return 1
    if s in {"false", "0", "regular", "regular season", "no"}:
        return 0
    return 1 if s else 0


def load_alias_map() -> dict[str, str]:
    with open(ALIASES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {norm_name(k): norm_name(v) for k, v in raw.items() if norm_name(v)}


def read_csv_files():
    files = sorted(
        glob.glob(os.path.join(RAW_DIR, "*_LoL_esports_match_data_from_OraclesElixir.csv"))
        + glob.glob(os.path.join(RAW_DIR, "*_LoL_esports_match_data_from_OraclesElixir.xlsx"))
    )
    if not files:
        print(f"No data files found under {RAW_DIR}. Run scripts/fetch-data.ps1 first.")
        sys.exit(1)
    for fp in files:
        print(f"Reading {os.path.basename(fp)} ...")
        if fp.lower().endswith(".xlsx"):
            df = pd.read_excel(fp)
        else:
            df = pd.read_csv(fp, low_memory=False, encoding="utf-8")
        rename_map = {v: k for k, v in COLUMN_ALIASES.items() if v in df.columns}
        if rename_map:
            df = df.rename(columns=rename_map)
        missing = [c for c in NEEDED_COLUMNS if c not in df.columns]
        for c in missing:
            if c in {"matchid", "split", "playoffs", "game", "champion", "position"}:
                df[c] = ""
            else:
                print(f"  Warning: missing column {c!r} in {os.path.basename(fp)}, skipping file")
                df = None
                break
        if df is None:
            continue
        yield df[NEEDED_COLUMNS]


def build():
    alias_map = load_alias_map()
    frames = read_csv_files()

    player_rows: dict[str, dict] = {}   # norm -> info
    name_counter: Counter = Counter()   # (norm, display) -> count
    game_rows: dict[str, dict] = {}     # gameid -> game info
    game_players: dict[str, list[dict]] = {}  # gameid -> [player rows]

    total_rows = 0
    excluded_exhibition = 0
    for df in frames:
        df = df.dropna(subset=["player"])
        df["player"] = df["player"].astype(str).str.strip()
        df = df[df["player"] != ""]
        df = df[df["position"].fillna("").astype(str).str.strip().str.upper() != "TEAM"]
        df["norm_"] = df["player"].map(norm_name)
        df = df[df["norm_"] != ""]
        df["date_"] = df["date"].map(clean_date)
        df["matchid_"] = df["matchid"].fillna("").astype(str).str.strip()
        df.loc[df["matchid_"] == "", "matchid_"] = df["gameid"].astype(str)
        df["playoffs_"] = df["playoffs"].map(parse_bool)
        df["game_"] = df["game"].fillna(1).astype(str)
        df["position_"] = df["position"].fillna("").astype(str).str.strip().str.upper().replace("", "UNK")
        df["team_"] = df["team"].fillna("").astype(str).str.strip()
        df["result_"] = df["result"].fillna(0).astype(int)
        df["side_"] = df["side"].fillna("").astype(str).str.strip()
        df["league_"] = df["league"].fillna("").astype(str).str.strip()
        total_rows += len(df)
        exhibition_mask = df["league_"].str.lower().str.contains("all-star", na=False)
        excluded_exhibition += int(exhibition_mask.sum())
        df = df[~exhibition_mask]

        for rec in df.itertuples(index=False):
            norm = rec.norm_
            display = rec.player
            name_counter[(norm, display)] += 1
            pinfo = player_rows.setdefault(norm, {
                "norm": norm,
                "positions": Counter(),
                "teams": Counter(),
                "year_teams": {},  # year -> team counter
                "years": set(),
                "games": 0,
            })
            pinfo["positions"][rec.position_] += 1
            if rec.team_:
                pinfo["teams"][rec.team_] += 1
                y = rec.date_[:4]
                if y:
                    pinfo["year_teams"].setdefault(y, Counter())[rec.team_] += 1
            if rec.date_[:4]:
                pinfo["years"].add(rec.date_[:4])
            pinfo["games"] += 1

            gid = str(rec.gameid).strip()
            if gid not in game_rows:
                blue_win = None
                # blue_win resolved later from side/result rows
                game_rows[gid] = {
                    "gameid": gid,
                    "matchid": rec.matchid_,
                    "date": rec.date_,
                    "year": rec.date_[:4] or "",
                    "league": rec.league_,
                    "split": "" if pd.isna(rec.split) else str(rec.split).strip(),
                    "playoffs": rec.playoffs_,
                    "game_number": rec.game_,
                    "blue_team": "",
                    "red_team": "",
                    "blue_win": None,
                    "sides": {},
                }
                game_players[gid] = []
            ginfo = game_rows[gid]
            if rec.side_:
                ginfo["sides"].setdefault(rec.side_, set()).add(rec.team_)
            game_players[gid].append({
                "norm": norm,
                "team": rec.team_,
                "side": rec.side_,
                "position": rec.position_,
                "champion": str(rec.champion).strip(),
                "result": rec.result_,
            })

    print(f"Raw player-game rows: {total_rows:,}")
    print(f"Excluded exhibition (All-Star) rows: {excluded_exhibition:,}")

    # Resolve canonical display name per norm.
    for (norm, display), cnt in name_counter.items():
        info = player_rows[norm]
        best = info.get("_display")
        if best is None or cnt > name_counter[(norm, best)]:
            info["_display"] = display

    # Dynamic: Leaguepedia disambiguates with parenthetical suffixes, e.g.
    # "Wolf (Lee Jae-wan)" -> plain tag "Wolf". Merge into the plain tag only
    # when the base tag exists as a player AND has exactly one parenthetical
    # variant (unambiguous). Bases with multiple variants (e.g. two different
    # "Uzi") are handled via curated seed aliases instead.
    # Skip "real-name style" entries where the parenthetical's first word equals
    # the base (e.g. "TIAN (Tian Ye)" = Meiko, but "Tian" is also a jungler):
    # those must go through curated aliases to avoid colliding with unrelated
    # players who share the same surname as a tag.
    variants: dict[str, set[str]] = defaultdict(set)
    for norm, display in name_counter:
        m = re.match(r"^(.+?)\s*\(([^)]*)\)\s*$", display)
        if m:
            base = norm_name(m.group(1))
            inner = re.match(r"\s*(\S+)", m.group(2))
            first_word = norm_name(inner.group(1)) if inner else ""
            if base and base != first_word:
                variants[base].add(norm)
    dynamic = {}
    for base, norms in variants.items():
        if len(norms) == 1 and base in player_rows:
            n = next(iter(norms))
            if n != base:
                dynamic[n] = base
    if dynamic:
        print(f"Dynamic disambiguation merges: {len(dynamic)}")
        for norm, target in dynamic.items():
            src = player_rows.pop(norm)
            dst = player_rows[target]
            for k in ("positions", "teams"):
                dst[k].update(src[k])
            for y, c in src["year_teams"].items():
                dst["year_teams"].setdefault(y, Counter()).update(c)
            dst["years"] |= src["years"]
            dst["games"] += src["games"]
            # keep dst display (the plain base tag)
        for rows in game_players.values():
            for r in rows:
                r["norm"] = dynamic.get(r["norm"], r["norm"])

    # Apply seed alias remapping: a player norm equal to an alias key merges
    # into the alias target (handles alternate in-data spellings).
    merged = {}
    for norm in list(player_rows):
        target = alias_map.get(norm)
        if target and target != norm and target in player_rows:
            merged[norm] = target
    for norm, target in merged.items():
        src = player_rows.pop(norm)
        dst = player_rows.setdefault(target, {
            "norm": target,
            "positions": Counter(),
            "teams": Counter(),
            "year_teams": {},
            "years": set(),
            "games": 0,
        })
        for k in ("positions", "teams"):
            dst[k].update(src[k])
        for y, c in src["year_teams"].items():
            dst["year_teams"].setdefault(y, Counter()).update(c)
        dst["years"] |= src["years"]
        dst["games"] += src["games"]
        if src.get("_display") and not dst.get("_display"):
            dst["_display"] = src["_display"]
    if merged:
        print(f"Merged {len(merged)} name variants via seed aliases.")
        for rows in game_players.values():
            for r in rows:
                r["norm"] = merged.get(r["norm"], r["norm"])

    player_id_of = {}
    players_out = []
    for i, (norm, info) in enumerate(sorted(player_rows.items())):
        pid = i + 1
        player_id_of[norm] = pid
        positions = [p for p, _ in info["positions"].most_common(3)]
        teams = [t for t, _ in info["teams"].most_common(5)]
        last_team = ""
        if info["year_teams"]:
            last_year = max(info["year_teams"])
            last_team = info["year_teams"][last_year].most_common(1)[0][0]
        players_out.append({
            "id": pid,
            "name": info.get("_display") or norm,
            "norm": norm,
            "positions": json.dumps(positions, ensure_ascii=False),
            "teams": json.dumps(teams, ensure_ascii=False),
            "last_team": last_team,
            "first_year": min(info["years"]) if info["years"] else "",
            "last_year": max(info["years"]) if info["years"] else "",
            "games": info["games"],
        })

    aliases_out = []
    seen_alias = set()
    for norm, info in player_rows.items():
        pid = player_id_of[norm]
        display = info.get("_display") or norm
        candidates = {display}
        for alias_norm, target_norm in alias_map.items():
            if target_norm == norm:
                candidates.add(alias_norm)
        for c in candidates:
            cn = norm_name(c)
            if not cn or (pid, cn) in seen_alias:
                continue
            seen_alias.add((pid, cn))
            aliases_out.append({"player_id": pid, "alias": c, "alias_norm": cn})

    # Resolve blue team/winner per game.
    games_out = []
    for gid, ginfo in game_rows.items():
        sides = ginfo.pop("sides")
        blue = sorted(sides.get("Blue", set()))
        red = sorted(sides.get("Red", set()))
        ginfo["blue_team"] = blue[0] if blue else ""
        ginfo["red_team"] = red[0] if red else ""
        ginfo["blue_win"] = None
        if not ginfo["matchid"] or ginfo["matchid"] == gid:
            pair = "~".join(sorted([ginfo["blue_team"], ginfo["red_team"]]))
            ginfo["matchid"] = f"{ginfo['league']}|{ginfo['date']}|{pair}"
        games_out.append(ginfo)

    # Oracle's Elixir CSVs have no real matchid: the generated id embeds the
    # date, which splits series that straddle midnight into two "series".
    # Rebuild a stable series id from continuity: same league/split/playoffs/
    # teams, adjacent dates, and continuing game numbers -> same series.
    def _series_num(v):
        try:
            n = int(float(str(v)))
        except (TypeError, ValueError):
            n = 0
        return n if n > 0 else 1

    def _day_gap(a, b):
        try:
            return (pd.Timestamp(b).date() - pd.Timestamp(a).date()).days
        except Exception:
            return 99

    series_groups = defaultdict(list)
    for gid, g in game_rows.items():
        if not g["blue_team"] or not g["red_team"]:
            continue
        pair = "~".join(sorted([g["blue_team"], g["red_team"]]))
        series_groups[(g["league"], g["split"], bool(g["playoffs"]), pair)].append(gid)

    for key, gids in series_groups.items():
        gids.sort(key=lambda gid: (game_rows[gid]["date"],
                                   _series_num(game_rows[gid]["game_number"]), gid))
        idx = 0
        prev_d, prev_n = None, None
        for gid in gids:
            g = game_rows[gid]
            n = _series_num(g["game_number"])
            if prev_d is None:
                idx += 1
            elif _day_gap(prev_d, g["date"]) > 1 or n <= prev_n:
                idx += 1
            g["matchid"] = "|".join([key[0], key[1], str(key[2]), key[3], f"S{idx}"])
            prev_d, prev_n = g["date"], n

    # h2h counters
    pair_stats = defaultdict(lambda: {"games": 0, "a_wins": 0, "b_wins": 0,
                                      "first": "", "last": ""})
    series_stats = defaultdict(lambda: {"games": 0, "a_wins": 0, "b_wins": 0})

    for gid, rows in game_players.items():
        ginfo = game_rows[gid]
        date = ginfo["date"]
        mid = ginfo["matchid"]
        by_side = {"Blue": [], "Red": []}
        for r in rows:
            side = r["side"] if r["side"] in by_side else ("Blue" if not r["side"] else r["side"])
            if side in by_side:
                by_side[side].append(r)
        # resolve blue_win
        if ginfo["blue_win"] is None:
            for r in by_side["Blue"]:
                ginfo["blue_win"] = 1 if r["result"] == 1 else 0
                break
            if ginfo["blue_win"] is None:
                for r in by_side["Red"]:
                    ginfo["blue_win"] = 0 if r["result"] == 1 else 1
                    break
        if ginfo["blue_win"] is None:
            ginfo["blue_win"] = 0

        for ra in by_side["Blue"]:
            for rb in by_side["Red"]:
                na, nb = ra["norm"], rb["norm"]
                if na == nb:
                    continue
                pa, pb = player_id_of[na], player_id_of[nb]
                x, y = (pa, pb) if pa < pb else (pb, pa)
                a_is_x = pa == x
                ra_win = 1 if ra["result"] == 1 else 0
                rb_win = 1 if rb["result"] == 1 else 0
                key = (x, y)
                ps = pair_stats[key]
                ps["games"] += 1
                if a_is_x:
                    ps["a_wins"] += ra_win
                    ps["b_wins"] += rb_win
                else:
                    ps["a_wins"] += rb_win
                    ps["b_wins"] += ra_win
                if not ps["first"] or date < ps["first"]:
                    ps["first"] = date
                if date > ps["last"]:
                    ps["last"] = date

                skey = (x, y, mid)
                ss = series_stats[skey]
                ss["games"] += 1
                if a_is_x:
                    ss["a_wins"] += ra_win
                    ss["b_wins"] += rb_win
                else:
                    ss["a_wins"] += rb_win
                    ss["b_wins"] += ra_win

    pair_series: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    for (x, y, _mid), ss in series_stats.items():
        pair_series[(x, y)].append((ss["a_wins"], ss["b_wins"]))

    h2h_out = []
    for (x, y), ps in pair_stats.items():
        wins = pair_series.get((x, y), [])
        series = len(wins)
        a_series_wins = sum(1 for aw, bw in wins if aw > bw)
        b_series_wins = sum(1 for aw, bw in wins if bw > aw)
        h2h_out.append({
            "player_a_id": x,
            "player_b_id": y,
            "games": ps["games"],
            "a_wins": ps["a_wins"],
            "b_wins": ps["b_wins"],
            "series": series,
            "a_series_wins": a_series_wins,
            "b_series_wins": b_series_wins,
            "first_date": ps["first"],
            "last_date": ps["last"],
        })

    # Write DB
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE players (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          norm TEXT NOT NULL UNIQUE,
          positions TEXT NOT NULL DEFAULT '[]',
          teams TEXT NOT NULL DEFAULT '[]',
          last_team TEXT NOT NULL DEFAULT '',
          first_year TEXT NOT NULL DEFAULT '',
          last_year TEXT NOT NULL DEFAULT '',
          games INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE aliases (
          player_id INTEGER NOT NULL REFERENCES players(id),
          alias TEXT NOT NULL,
          alias_norm TEXT NOT NULL
        );
        CREATE INDEX idx_aliases_norm ON aliases(alias_norm);
        CREATE TABLE games (
          id INTEGER PRIMARY KEY,
          gameid TEXT NOT NULL UNIQUE,
          matchid TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL DEFAULT '',
          year TEXT NOT NULL DEFAULT '',
          league TEXT NOT NULL DEFAULT '',
          split TEXT NOT NULL DEFAULT '',
          playoffs INTEGER NOT NULL DEFAULT 0,
          game_number TEXT NOT NULL DEFAULT '1',
          blue_team TEXT NOT NULL DEFAULT '',
          red_team TEXT NOT NULL DEFAULT '',
          blue_win INTEGER
        );
        CREATE INDEX idx_games_date ON games(date);
        CREATE INDEX idx_games_matchid ON games(matchid);
        CREATE TABLE match_players (
          game_id INTEGER NOT NULL REFERENCES games(id),
          player_id INTEGER NOT NULL REFERENCES players(id),
          team TEXT NOT NULL DEFAULT '',
          side TEXT NOT NULL DEFAULT '',
          position TEXT NOT NULL DEFAULT '',
          champion TEXT NOT NULL DEFAULT '',
          result INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_mp_player ON match_players(player_id);
        CREATE INDEX idx_mp_game ON match_players(game_id);
        CREATE INDEX idx_mp_player_game ON match_players(player_id, game_id);
        CREATE TABLE h2h (
          player_a_id INTEGER NOT NULL,
          player_b_id INTEGER NOT NULL,
          games INTEGER NOT NULL DEFAULT 0,
          a_wins INTEGER NOT NULL DEFAULT 0,
          b_wins INTEGER NOT NULL DEFAULT 0,
          series INTEGER NOT NULL DEFAULT 0,
          a_series_wins INTEGER NOT NULL DEFAULT 0,
          b_series_wins INTEGER NOT NULL DEFAULT 0,
          first_date TEXT NOT NULL DEFAULT '',
          last_date TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (player_a_id, player_b_id)
        );
        CREATE INDEX idx_h2h_a ON h2h(player_a_id);
        CREATE INDEX idx_h2h_b ON h2h(player_b_id);
        """
    )

    cur.executemany(
        "INSERT INTO players VALUES (:id,:name,:norm,:positions,:teams,:last_team,:first_year,:last_year,:games)",
        players_out,
    )
    cur.executemany(
        "INSERT INTO aliases VALUES (:player_id,:alias,:alias_norm)",
        aliases_out,
    )
    cur.executemany(
        """INSERT INTO games (gameid,matchid,date,year,league,split,playoffs,game_number,blue_team,red_team,blue_win)
           VALUES (:gameid,:matchid,:date,:year,:league,:split,:playoffs,:game_number,:blue_team,:red_team,:blue_win)""",
        games_out,
    )
    game_id_of = {}
    for row in cur.execute("SELECT id, gameid FROM games"):
        game_id_of[row[1]] = row[0]

    mp_out = []
    for gid, rows in game_players.items():
        gdb_id = game_id_of[gid]
        for r in rows:
            mp_out.append({
                "game_id": gdb_id,
                "player_id": player_id_of[r["norm"]],
                "team": r["team"],
                "side": r["side"],
                "position": r["position"],
                "champion": r["champion"],
                "result": r["result"],
            })
    cur.executemany(
        "INSERT INTO match_players VALUES (:game_id,:player_id,:team,:side,:position,:champion,:result)",
        mp_out,
    )
    cur.executemany(
        """INSERT INTO h2h VALUES (:player_a_id,:player_b_id,:games,:a_wins,:b_wins,:series,
           :a_series_wins,:b_series_wins,:first_date,:last_date)""",
        h2h_out,
    )
    conn.commit()

    stats = {}
    for table in ("players", "aliases", "games", "match_players", "h2h"):
        stats[table] = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()

    print("DB written:", DB_PATH)
    for k, v in stats.items():
        print(f"  {k}: {v:,}")
    print(f"  h2h pairs with >=10 games: "
          f"{sum(1 for h in h2h_out if h['games'] >= 10):,}")


if __name__ == "__main__":
    build()
