import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type {
  ArticleAiExtracted,
  ArticleSortBy,
  CityArticleCount,
  CityRecommendation,
  HistoryEntry,
  PlaceDigest,
  TopicRecommendation,
} from "@/lib/types";
import { ApiError } from "@/lib/server/api-error";
import { db } from "@/lib/server/firebase-admin";
import { getCanonicalChinaBlockCities, toCanonicalCityName } from "@/lib/city-name-mapping";

export const MAX_IMAGE_COUNT = 3;
export const MAX_CONTENT_CHARS = 600;

type CreateArticleInput = {
  id?: string;
  title: string;
  content: string;
  imageUrls: string[];
  imageStoragePaths: string[];
  useAiFineTune: boolean;
  articleTime?: string;
  aiExtracted?: ArticleAiExtracted;
  city?: string;
  topic?: string;
  tags?: string[];
};

type StoredArticle = {
  id: string;
  title: string;
  city: string;
  topic: string;
  tags: string[];
  content: string;
  imageUrls: string[];
  imageStoragePaths: string[];
  aiExtracted: ArticleAiExtracted;
  articleTime: Timestamp;
  createTime: Timestamp;
  useAiFineTune: boolean;
  searchText: string;
};

function articlesCollection(userId: string) {
  return db().collection("users").doc(userId).collection("articles");
}

function normalizeText(value: string) {
  return value.trim();
}

function countCharacters(input: string) {
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

export function inferTopicFromText(title: string, content: string) {
  const source = `${title} ${content}`.toLowerCase();
  if (source.includes("food") || source.includes("hotpot")) {
    return "Food Memory";
  }
  if (source.includes("book") || source.includes("read")) {
    return "Reading Memory";
  }
  if (source.includes("walk") || source.includes("lake")) {
    return "Nature Walk";
  }
  return "General Memory";
}

function extractKeywords(title: string, content: string) {
  const words = `${title} ${content}`
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length >= 3);
  return Array.from(new Set(words)).slice(0, 8);
}

export function inferCityFromText(text: string) {
  const lower = text.toLowerCase();
  const mapping: Array<[string, string]> = [
    ["hangzhou", "Hangzhou"],
    ["shanghai", "Shanghai"],
    ["chengdu", "Chengdu"],
    ["beijing", "Beijing"],
    ["shenzhen", "Shenzhen"],
    ["guangzhou", "Guangzhou"],
  ];
  const found = mapping.find(([keyword]) => lower.includes(keyword));
  return found?.[1] ?? "Unknown";
}

export function buildNaiveAiExtracted(title: string, content: string): ArticleAiExtracted {
  const summaryBase = normalizeText(content || title);
  const summary = summaryBase.length > 160 ? `${summaryBase.slice(0, 160)}...` : summaryBase;
  const keywords = extractKeywords(title, content);
  const places = [inferCityFromText(`${title} ${content}`)].filter((city) => city !== "Unknown");
  return {
    summary: summary || "No summary available.",
    keywords,
    places,
    persons: [],
    organizations: [],
    dates: [],
    tone: "reflective",
  };
}

function toIso(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return new Date().toISOString();
}

function toHistoryEntry(data: StoredArticle): HistoryEntry {
  return {
    id: data.id,
    title: data.title,
    city: data.city,
    topic: data.topic,
    tags: data.tags,
    content: data.content,
    imageUrls: data.imageUrls,
    aiExtracted: data.aiExtracted,
    articleTime: toIso(data.articleTime),
    createTime: toIso(data.createTime),
  };
}

export function searchableText(entry: HistoryEntry): string {
  return [
    entry.title,
    entry.city,
    entry.topic,
    entry.content,
    entry.tags.join(" "),
    entry.aiExtracted.summary,
    entry.aiExtracted.keywords.join(" "),
    entry.aiExtracted.places.join(" "),
    entry.aiExtracted.persons?.join(" ") ?? "",
    entry.aiExtracted.organizations?.join(" ") ?? "",
    entry.aiExtracted.dates?.join(" ") ?? "",
    entry.aiExtracted.tone ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function initialsFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "U";
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 2) || "U";
}

export function validateArticlePayload(content: string, imageUrls: string[]) {
  if (imageUrls.length > MAX_IMAGE_COUNT) {
    throw new ApiError(400, `At most ${MAX_IMAGE_COUNT} images are allowed.`);
  }
  if (countCharacters(content) > MAX_CONTENT_CHARS) {
    throw new ApiError(400, `At most ${MAX_CONTENT_CHARS} characters are allowed.`);
  }
}

export async function createArticle(userId: string, input: CreateArticleInput) {
  const articleId = input.id ?? randomUUID();
  const title = normalizeText(input.title) || "Untitled";
  const content = input.content;
  const aiExtracted = input.aiExtracted ?? buildNaiveAiExtracted(title, content);
  const topic = normalizeText(input.topic ?? "") || inferTopicFromText(title, content);
  const rawCity =
    normalizeText(input.city ?? "") ||
    aiExtracted.places[0] ||
    inferCityFromText(`${title} ${content}`);
  const city = toCanonicalCityName(rawCity) ?? rawCity;
  const tags = (input.tags ?? aiExtracted.keywords.slice(0, 5)).map((item) => item.trim()).filter(Boolean);

  const now = new Date();
  const articleTime = input.articleTime ? new Date(input.articleTime) : now;
  if (Number.isNaN(articleTime.getTime())) {
    throw new ApiError(400, "articleTime must be a valid ISO date string.");
  }

  const payload: StoredArticle = {
    id: articleId,
    title,
    city,
    topic,
    tags,
    content,
    imageUrls: input.imageUrls,
    imageStoragePaths: input.imageStoragePaths,
    aiExtracted,
    articleTime: Timestamp.fromDate(articleTime),
    createTime: Timestamp.fromDate(now),
    useAiFineTune: input.useAiFineTune,
    searchText: searchableText({
      id: articleId,
      title,
      city,
      topic,
      tags,
      content,
      imageUrls: input.imageUrls,
      aiExtracted,
      articleTime: articleTime.toISOString(),
      createTime: now.toISOString(),
    }),
  };

  await articlesCollection(userId).doc(articleId).set(payload);
  return toHistoryEntry(payload);
}

export async function listArticles(
  userId: string,
  sortByInput: string | null,
  searchInput: string | null,
) {
  const sortBy = normalizeSortBy(sortByInput);
  const search = searchInput?.trim() ?? "";
  const searchQuery = search.toLowerCase();

  const entries = await getArticleHistoryEntries(userId);
  const filtered = searchQuery
    ? entries.filter((entry) => searchableText(entry).includes(searchQuery))
    : entries;

  if (sortBy === "articleTime") {
    filtered.sort((a, b) => Date.parse(b.articleTime) - Date.parse(a.articleTime));
  } else if (sortBy === "topic") {
    filtered.sort((a, b) => a.topic.localeCompare(b.topic));
  } else if (sortBy === "title") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    filtered.sort((a, b) => Date.parse(b.createTime) - Date.parse(a.createTime));
  }

  return { sortBy, search, entries: filtered };
}

export async function getArticleHistoryEntries(userId: string) {
  const snapshot = await articlesCollection(userId).get();
  return snapshot.docs.map((doc) => toHistoryEntry(doc.data() as StoredArticle));
}

export async function getPlaceDigest(userId: string, cityInput: string, email: string) {
  const city = cityInput.trim();
  const digests = await getPlaceDigests(userId, [city], email);
  return (
    digests[0] ?? {
      city,
      articleCount: 0,
      avatars: [],
      topics: [],
    }
  );
}

export async function getPlaceDigests(userId: string, citiesInput: readonly string[], email: string) {
  const normalizedRequests = citiesInput
    .map((city) => city.trim())
    .filter(Boolean)
    .map((city) => ({ city, canonicalCity: toCanonicalCityName(city) }));
  if (normalizedRequests.length === 0) {
    return [];
  }

  const uniqueCanonicalCities = Array.from(
    new Set(normalizedRequests.map((item) => item.canonicalCity).filter((city): city is string => Boolean(city))),
  );
  const canonicalCitySet = new Set(uniqueCanonicalCities);

  const snapshot = await articlesCollection(userId).get();
  const entries = snapshot.docs.map((doc) => toHistoryEntry(doc.data() as StoredArticle));

  const articleCounts = new Map<string, number>();
  const topicCountsByCity = new Map<string, Map<string, number>>();

  for (const entry of entries) {
    const canonicalEntryCity = toCanonicalCityName(entry.city);
    if (!canonicalEntryCity || !canonicalCitySet.has(canonicalEntryCity)) {
      continue;
    }

    articleCounts.set(canonicalEntryCity, (articleCounts.get(canonicalEntryCity) ?? 0) + 1);
    const topicCounts = topicCountsByCity.get(canonicalEntryCity) ?? new Map<string, number>();
    topicCounts.set(entry.topic, (topicCounts.get(entry.topic) ?? 0) + 1);
    topicCountsByCity.set(canonicalEntryCity, topicCounts);
  }

  return normalizedRequests.map(({ city, canonicalCity }) => {
    const topicCounts = canonicalCity ? (topicCountsByCity.get(canonicalCity) ?? new Map<string, number>()) : new Map<string, number>();
    const topics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
    const articleCount = canonicalCity ? (articleCounts.get(canonicalCity) ?? 0) : 0;
    return {
      city,
      articleCount,
      avatars: articleCount > 0 ? [initialsFromEmail(email)] : [],
      topics,
    } satisfies PlaceDigest;
  });
}

export async function getAllCityArticleCounts(userId: string): Promise<CityArticleCount[]> {
  const canonicalCities = getCanonicalChinaBlockCities();
  const articleCounts = new Map<string, number>(canonicalCities.map((city) => [city, 0]));

  const snapshot = await articlesCollection(userId).get();
  for (const doc of snapshot.docs) {
    const entry = toHistoryEntry(doc.data() as StoredArticle);
    const canonicalCity = toCanonicalCityName(entry.city);
    if (!canonicalCity || !articleCounts.has(canonicalCity)) {
      continue;
    }
    articleCounts.set(canonicalCity, (articleCounts.get(canonicalCity) ?? 0) + 1);
  }

  return canonicalCities.map((city) => ({
    city,
    articleCount: articleCounts.get(city) ?? 0,
  }));
}

export async function getTodayTopicRecommendations(userId: string) {
  const entries = await getArticleHistoryEntries(userId);
  return buildNaiveTopicRecommendations(entries);
}

export function buildNaiveTopicRecommendations(entries: HistoryEntry[]) {
  const topicCounts = new Map<string, number>();

  for (const entry of entries) {
    topicCounts.set(entry.topic, (topicCounts.get(entry.topic) ?? 0) + 1);
  }

  const recommendations: TopicRecommendation[] = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count], index) => ({
      id: `topic-${index + 1}-${topic.toLowerCase().replace(/\s+/g, "-")}`,
      title: topic,
      reason: `Based on ${count} related article${count > 1 ? "s" : ""} in your history.`,
    }));

  return recommendations;
}

export async function getTodayCityRecommendation(userId: string): Promise<CityRecommendation> {
  const entries = await getArticleHistoryEntries(userId);
  return buildNaiveCityRecommendation(entries);
}

export function buildNaiveCityRecommendation(entries: HistoryEntry[]): CityRecommendation {
  if (!entries.length) {
    return {
      city: "Unknown",
      brief: "No article data yet. Add a few entries to generate recommendation.",
      highlights: [],
      digest: {
        ingestedArticles: 0,
        topTopics: [],
      },
    };
  }

  const cityCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  for (const entry of entries) {
    const normalizedCity = toCanonicalCityName(entry.city) ?? entry.city;
    cityCounts.set(normalizedCity, (cityCounts.get(normalizedCity) ?? 0) + 1);
    topicCounts.set(entry.topic, (topicCounts.get(entry.topic) ?? 0) + 1);
  }

  const selectedCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  return {
    city: selectedCity,
    brief: `Most active city in your memories recently: ${selectedCity}.`,
    highlights: topTopics,
    digest: {
      ingestedArticles: entries.length,
      topTopics,
    },
  };
}
