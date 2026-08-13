import { NextRequest, NextResponse } from "next/server";
import { getRankings } from "@/lib/h2h";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const playerRaw = request.nextUrl.searchParams.get("player") ?? "";
  const typeRaw = request.nextUrl.searchParams.get("type") ?? "son";
  const minGamesRaw = request.nextUrl.searchParams.get("min_games") ?? "10";
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "30";
  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;

  const playerId = Number(playerRaw);
  const minGames = Number(minGamesRaw);
  const limit = Number(limitRaw);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: "invalid player id" }, { status: 400 });
  }
  if (typeRaw !== "dad" && typeRaw !== "son") {
    return NextResponse.json({ error: "type must be dad or son" }, { status: 400 });
  }
  if (!Number.isInteger(minGames) || minGames < 1) {
    return NextResponse.json({ error: "invalid min_games" }, { status: 400 });
  }
  try {
    const result = getRankings(
      playerId,
      typeRaw,
      minGames,
      from,
      to,
      Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 30
    );
    return NextResponse.json({ ...result, type: typeRaw, minGames });
  } catch (e) {
    const message = e instanceof Error ? e.message : "database error";
    if (message.includes("player not found")) {
      return NextResponse.json({ error: "player not found" }, { status: 404 });
    }
    const status = message.includes("no such table") || message.includes("unable to open")
      ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
