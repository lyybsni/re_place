import { NextRequest, NextResponse } from "next/server";
import { placeDigests } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { message: "Missing required query param: city" },
      { status: 400 },
    );
  }

  const normalized = city.toLowerCase();
  const digest = placeDigests[normalized];

  if (!digest) {
    return NextResponse.json(
      {
        city,
        articleCount: 0,
        avatars: [],
        topics: [],
      },
      { status: 200 },
    );
  }

  return NextResponse.json(digest);
}
