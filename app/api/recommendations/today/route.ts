import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import { getTodayTopicRecommendations } from "@/lib/server/repositories/articles-repository";

export async function GET() {
  try {
    const session = await requireSession();
    const topics = await getTodayTopicRecommendations(session.userId);
    return NextResponse.json(topics.slice(0, 5));
  } catch (error) {
    return errorResponse(error);
  }
}
