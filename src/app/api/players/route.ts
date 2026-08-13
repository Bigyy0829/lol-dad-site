import { NextRequest, NextResponse } from "next/server";
import { getPlayer, searchPlayers } from "@/lib/h2h";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const idRaw = request.nextUrl.searchParams.get("id") ?? "";
  if (idRaw) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    try {
      const player = getPlayer(id);
      if (!player) {
        return NextResponse.json({ error: "player not found" }, { status: 404 });
      }
      return NextResponse.json({ player });
    } catch (e) {
      const message = e instanceof Error ? e.message : "database error";
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ players: [] });
  }
  try {
    const players = searchPlayers(q, 20);
    return NextResponse.json({ players });
  } catch (e) {
    const message = e instanceof Error ? e.message : "database error";
    const status = message.includes("no such table") || message.includes("unable to open")
      ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
