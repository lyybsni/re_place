import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import { getPlaceDigest } from "@/lib/server/repositories/articles-repository";

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
