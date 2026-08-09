import { NextResponse } from "next/server";
import { extractMemoryArticle } from "@/lib/server/ai-logic";
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
    };

    const content = payload.content?.trim() ?? "";
    if (!content) {
      throw new ApiError(400, "content is required.");
    }

    const mode = await getAiMode();
    const extractionResult = await extractMemoryArticle(mode, {
      title: payload.title,
      content,
    }, accessToken);

    return NextResponse.json({
      mode,
      ...extractionResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
