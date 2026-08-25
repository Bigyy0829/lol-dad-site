"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "@/lib/types";

interface Props {
  value: Player | null;
  onSelect: (player: Player | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const POS_SHORT: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JGL",
  JNG: "JGL",
  MID: "MID",
  BOT: "BOT",
  SUP: "SUP",
};

function posLabel(p: string): string {
  return POS_SHORT[p.toUpperCase()] ?? "POS";
}

export default function PlayerAutocomplete({
  value,
  onSelect,
  placeholder = "输入选手 ID，如 Bin / Faker",
  autoFocus,
}: Props) {
  const [text, setText] = useState(value?.name ?? "");
  const [results, setResults] = useState<Player[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/players?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (seq !== seqRef.current) return;
      setResults(Array.isArray(data.players) ? data.players : []);
      setActive(-1);
    } catch {
      if (seq === seqRef.current) setResults([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(true);
      search(q);
    }, 180);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, search]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(p: Player) {
    onSelect(p);
    setText(p.name);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1
      );
    } else if (e.key === "Enter") {
      if (active >= 0 && results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="ac" ref={rootRef}>
      <input
        className="input"
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onSelect(null);
        }}
        onFocus={() => {
          if (text.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="ac-menu">
          {loading && results.length === 0 ? (
            <div className="ac-item">
              <span className="ac-meta">搜索中…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="ac-item">
              <span className="ac-meta">没有找到匹配的选手</span>
            </div>
          ) : (
            results.map((p, i) => (
              <div
                key={p.id}
                className={`ac-item ${i === active ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <div className="ac-main">
                  {p.positions.length > 0 && (
                    <span className="ac-hex" aria-hidden="true">
                      {posLabel(p.positions[0])}
                    </span>
                  )}
                  <div>
                    <div className="ac-name">{p.name}</div>
                    <div className="ac-meta">
                      {p.teams.slice(0, 2).join(" · ") || "暂无战队"}
                      {p.positions.length ? ` · ${p.positions[0]}` : ""} ·{" "}
                      {p.games.toLocaleString()} 局
                    </div>
                  </div>
                </div>
                {p.aliases.length > 0 && (
                  <span className="ac-tag">{p.aliases.slice(0, 3).join(" / ")}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
