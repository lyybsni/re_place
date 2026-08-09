import { NextResponse } from "next/server";
import { recommendFromHistory } from "@/lib/server/ai-logic";
import { errorResponse } from "@/lib/server/api-error";
import { requireAccessToken, requireSession } from "@/lib/server/auth-session";
import { getAiMode } from "@/lib/server/repositories/admin-repository";
import { getArticleHistoryEntries } from "@/lib/server/repositories/articles-repository";

export async function GET() {
  try {
    const session = await requireSession();
    const accessToken = await requireAccessToken();
    const entries = await getArticleHistoryEntries(session.userId);
    const mode = await getAiMode();
    const recommendation = await recommendFromHistory(mode, {
      userId: session.userId,
      authIdToken: accessToken,
      entries,
      prompt: "Generate topic recommendations for the home dashboard.",
      maxRecommendations: 5,
    });
    return NextResponse.json(recommendation.topicRecommendations.slice(0, 5));
  } catch (error) {
    return errorResponse(error);
  }
}
