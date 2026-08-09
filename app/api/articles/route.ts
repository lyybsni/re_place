import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { errorResponse } from "@/lib/server/api-error";
import { requireAccessToken, requireSession } from "@/lib/server/auth-session";
import { extractMemoryArticle, polishMemoryArticle } from "@/lib/server/ai-logic";
import { getAiMode } from "@/lib/server/repositories/admin-repository";
import {
  createArticle,
  listArticles,
  validateArticlePayload,
} from "@/lib/server/repositories/articles-repository";
import { deleteStorageObjects, uploadArticleImages } from "@/lib/server/storage";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const accessToken = await requireAccessToken();
    const sortBy = request.nextUrl.searchParams.get("sortBy");
    const search = request.nextUrl.searchParams.get("search");
    const result = await listArticles(session.userId, sortBy, search);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  let uploadedPaths: string[] = [];
  try {
    const session = await requireSession();
    const accessToken = await requireAccessToken();
    const payload = (await request.json()) as {
      title?: string;
      content?: string;
      imageUrls?: string[];
      useAiFineTune?: boolean;
      articleTime?: string;
    };

    const title = payload.title ?? "";
    const content = payload.content ?? "";
    const imageUrls = payload.imageUrls ?? [];
    validateArticlePayload(content, imageUrls);

    const aiMode = await getAiMode();
    const polishResult =
      payload.useAiFineTune
        ? await polishMemoryArticle(aiMode, { title, content }, accessToken)
        : null;
    const finalTitle = polishResult?.title ?? title;
    const finalContent = polishResult?.polishedText ?? content;
    const extractionResult = await extractMemoryArticle(aiMode, {
      title: finalTitle,
      content: finalContent,
    }, accessToken);

    const articleId = randomUUID();
    const uploaded = await uploadArticleImages(session.userId, articleId, imageUrls);
    uploadedPaths = uploaded.map((item) => item.path);

    const entry = await createArticle(session.userId, {
      id: articleId,
      title: finalTitle,
      content: finalContent,
      imageUrls: uploaded.map((item) => item.url),
      imageStoragePaths: uploadedPaths,
      useAiFineTune: Boolean(payload.useAiFineTune),
      articleTime: payload.articleTime,
      aiExtracted: {
        summary: extractionResult.summary,
        keywords: extractionResult.keywords,
        places: extractionResult.places,
        persons: extractionResult.persons,
        organizations: extractionResult.organizations,
        dates: extractionResult.dates,
        tone: extractionResult.tone,
      },
      city: extractionResult.city,
      topic: extractionResult.topic,
      tags: extractionResult.keywords.slice(0, 5),
    });

    return NextResponse.json(
      {
        message: "Article created.",
        accepted: true,
        entry,
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await deleteStorageObjects(uploadedPaths);
    }
    return errorResponse(error);
  }
}
