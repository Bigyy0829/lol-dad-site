import RankingView from "@/components/RankingView";

interface Props {
  params: Promise<{ player: string }>;
  searchParams: Promise<{
    type?: string;
    min_games?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function RankingPlayerPage({ params, searchParams }: Props) {
  const { player } = await params;
  const sp = await searchParams;
  const playerId = Number(player);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return (
      <div className="container">
        <div className="error-box">无效的选手 ID</div>
      </div>
    );
  }
  const type = sp.type === "dad" ? "dad" : sp.type === "son" ? "son" : "son";
  const minGames = Number(sp.min_games);
  return (
    <RankingView
      playerId={playerId}
      initialType={type}
      initialMinGames={Number.isInteger(minGames) && minGames > 0 ? minGames : 10}
      initialFrom={sp.from}
      initialTo={sp.to}
    />
  );
}
