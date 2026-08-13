import { NextRequest, NextResponse } from "next/server";
import { getH2h, getPlayer } from "@/lib/h2h";
import { verdict } from "@/lib/verdict";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const aRaw = request.nextUrl.searchParams.get("a") ?? "";
  const bRaw = request.nextUrl.searchParams.get("b") ?? "";
  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;

  const aId = Number(aRaw);
  const bId = Number(bRaw);
  if (!Number.isInteger(aId) || !Number.isInteger(bId) || aId <= 0 || bId <= 0) {
    return NextResponse.json({ error: "invalid player id" }, { status: 400 });
  }
  try {
    const a = getPlayer(aId);
    const b = getPlayer(bId);
    if (!a) return NextResponse.json({ error: "player A not found" }, { status: 404 });
    if (!b) return NextResponse.json({ error: "player B not found" }, { status: 404 });

    const data = getH2h(aId, bId, from, to);
    const v = verdict({
      aName: a.name,
      bName: b.name,
      samePlayer: aId === bId,
      games: data.summary.games,
      aWins: data.summary.aWins,
      bWins: data.summary.bWins,
      series: data.summary.series,
      aSeriesWins: data.summary.aSeriesWins,
      bSeriesWins: data.summary.bSeriesWins,
    });
    return NextResponse.json({ ...data, verdict: v });
  } catch (e) {
    const message = e instanceof Error ? e.message : "database error";
    const status = message.includes("no such table") || message.includes("unable to open")
      ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
