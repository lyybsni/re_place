import { NextRequest, NextResponse } from "next/server";
import { historyEntries } from "@/lib/mock-data";
import type { ArticleSortBy } from "@/lib/types";

const MAX_IMAGE_COUNT = 3;
const MAX_CONTENT_CHARS = 600;

function countCharacters(input: string): number {
  return [...input].length;
}

function normalizeSortBy(value: string | null): ArticleSortBy {
  if (
    value === "articleTime" ||
    value === "createTime" ||
    value === "topic" ||
    value === "title"
  ) {
    return value;
  }
  return "createTime";
}

function searchableText(entry: (typeof historyEntries)[number]): string {
  return [
    entry.title,
    entry.city,
    entry.topic,
    entry.content,
    entry.tags.join(" "),
    entry.aiExtracted.summary,
    entry.aiExtracted.keywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export async function GET(request: NextRequest) {
  const sortBy = normalizeSortBy(request.nextUrl.searchParams.get("sortBy"));
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const searchQuery = search.toLowerCase();

  const entries = historyEntries.filter((entry) => {
    if (!searchQuery) {
      return true;
    }
    return searchableText(entry).includes(searchQuery);
  });

  if (sortBy === "articleTime") {
    entries.sort(
      (a, b) => Date.parse(b.articleTime) - Date.parse(a.articleTime),
    );
  } else if (sortBy === "topic") {
    entries.sort((a, b) => a.topic.localeCompare(b.topic));
  } else if (sortBy === "title") {
    entries.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    entries.sort((a, b) => Date.parse(b.createTime) - Date.parse(a.createTime));
  }

  return NextResponse.json({ sortBy, search, entries });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    title?: string;
    content?: string;
    imageUrls?: string[];
    useAiFineTune?: boolean;
  };

  const content = payload.content ?? "";
  const imageUrls = payload.imageUrls ?? [];

  if (imageUrls.length > MAX_IMAGE_COUNT) {
    return NextResponse.json(
      {
        message: `At most ${MAX_IMAGE_COUNT} images are allowed.`,
      },
      { status: 400 },
    );
  }

  if (countCharacters(content) > MAX_CONTENT_CHARS) {
    return NextResponse.json(
      {
        message: `At most ${MAX_CONTENT_CHARS} characters are allowed.`,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      message: "Article accepted by skeleton endpoint.",
      accepted: true,
    },
    { status: 201 },
  );
}
