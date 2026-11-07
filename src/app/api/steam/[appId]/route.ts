import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  const res = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(
      appId
    )}&cc=gb&l=english`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Steam request failed" }, { status: 502 });
  }

  return NextResponse.json(await res.json());
}