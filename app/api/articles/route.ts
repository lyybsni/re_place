import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import {
  createArticle,
  listArticles,
  validateArticlePayload,
} from "@/lib/server/repositories/articles-repository";
import { deleteStorageObjects, uploadArticleImages } from "@/lib/server/storage";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
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

    const articleId = randomUUID();
    const uploaded = await uploadArticleImages(session.userId, articleId, imageUrls);
    uploadedPaths = uploaded.map((item) => item.path);

    const entry = await createArticle(session.userId, {
      id: articleId,
      title,
      content,
      imageUrls: uploaded.map((item) => item.url),
      imageStoragePaths: uploadedPaths,
      useAiFineTune: Boolean(payload.useAiFineTune),
      articleTime: payload.articleTime,
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
