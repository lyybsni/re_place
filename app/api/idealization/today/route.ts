import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import { getTodayCityRecommendation } from "@/lib/server/repositories/articles-repository";

export async function GET() {
  try {
    const session = await requireSession();
    const recommendation = await getTodayCityRecommendation(session.userId);
    return NextResponse.json(recommendation);
  } catch (error) {
    return errorResponse(error);
  }
}
