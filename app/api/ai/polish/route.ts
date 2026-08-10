import { NextResponse } from "next/server";
import { extractMemoryArticle, polishMemoryArticle } from "@/lib/server/ai-logic";
import { ApiError, errorResponse } from "@/lib/server/api-error";
import { requireAccessToken, requireSession } from "@/lib/server/auth-session";
import { getAiMode } from "@/lib/server/repositories/admin-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireSession();
    const accessToken = await requireAccessToken();
    const payload = (await request.json()) as {
      title?: string;
      content?: string;
      tone?: string;
      city?: string;
      articleTime?: string;
    };

    const content = payload.content?.trim() ?? "";
    if (!content) {
      throw new ApiError(400, "content is required.");
    }

    const mode = await getAiMode();
    const polishResult = await polishMemoryArticle(mode, {
      title: payload.title,
      content,
      tone: payload.tone,
    }, accessToken);
    const extractionResult = await extractMemoryArticle(mode, {
      title: polishResult.title,
      content: polishResult.polishedText,
      city: payload.city,
      articleTime: payload.articleTime,
    }, accessToken);

    return NextResponse.json({
      mode,
      ...polishResult,
      extracted: extractionResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
