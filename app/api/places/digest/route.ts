import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import { getPlaceDigest, getPlaceDigests } from "@/lib/server/repositories/articles-repository";

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get("city");
    if (!city?.trim()) {
      throw new ApiError(400, "Missing required query param: city");
    }

    const session = await requireSession();
    const digest = await getPlaceDigest(session.userId, city, session.email);
    return NextResponse.json(digest);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { cities?: unknown };
    const cities = Array.isArray(payload.cities)
      ? payload.cities
          .filter((city): city is string => typeof city === "string")
          .map((city) => city.trim())
          .filter(Boolean)
      : [];
    if (cities.length === 0) {
      throw new ApiError(400, "Request body must include non-empty string array field: cities");
    }

    const session = await requireSession();
    const digests = await getPlaceDigests(session.userId, cities, session.email);
    return NextResponse.json({ digests });
  } catch (error) {
    return errorResponse(error);
  }
}
