import { NextResponse } from "next/server";
import { recommendFromHistory } from "@/lib/server/ai-logic";
import { ApiError, errorResponse } from "@/lib/server/api-error";
import { requireAccessToken, requireSession } from "@/lib/server/auth-session";
import { getAiMode } from "@/lib/server/repositories/admin-repository";
import { getArticleHistoryEntries } from "@/lib/server/repositories/articles-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const accessToken = await requireAccessToken();
    const payload = (await request.json()) as {
      prompt?: string;
      context?: string[];
      maxRecommendations?: number;
    };

    if (payload.context && !Array.isArray(payload.context)) {
      throw new ApiError(400, "context must be an array of strings.");
    }
    if (payload.context?.some((item) => typeof item !== "string")) {
      throw new ApiError(400, "context must be an array of strings.");
    }

    const maxRecommendations =
      payload.maxRecommendations == null ? 5 : Number(payload.maxRecommendations);
    if (
      !Number.isInteger(maxRecommendations) ||
      maxRecommendations < 1 ||
      maxRecommendations > 10
    ) {
      throw new ApiError(400, "maxRecommendations must be an integer between 1 and 10.");
    }

    const entries = await getArticleHistoryEntries(session.userId);
    const mode = await getAiMode();
    const recommendation = await recommendFromHistory(mode, {
      userId: session.userId,
      authIdToken: accessToken,
      prompt: payload.prompt,
      entries,
      extraContext: payload.context ?? [],
      maxRecommendations,
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    return errorResponse(error);
  }
}
