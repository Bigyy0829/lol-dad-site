import H2hView from "@/components/H2hView";

interface Props {
  params: Promise<{ a: string; b: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function H2hPage({ params, searchParams }: Props) {
  const { a, b } = await params;
  const sp = await searchParams;
  const aId = Number(a);
  const bId = Number(b);

  if (!Number.isInteger(aId) || !Number.isInteger(bId) || aId <= 0 || bId <= 0) {
    return (
      <div className="container">
        <div className="error-box">无效的选手 ID</div>
      </div>
    );
  }

  return (
    <H2hView
      aId={aId}
      bId={bId}
      initialFrom={sp.from}
      initialTo={sp.to}
    />
  );
}
