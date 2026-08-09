import { deleteApp, initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  AgentPlatformBackend,
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from "firebase/ai";
import { ApiError } from "@/lib/server/api-error";
import { readEnv, requireEnv } from "@/lib/server/env";
import { db } from "@/lib/server/firebase-admin";
import {
  buildNaiveAiExtracted,
  buildNaiveCityRecommendation,
  buildNaiveTopicRecommendations,
  inferCityFromText,
  inferTopicFromText,
  searchableText,
} from "@/lib/server/repositories/articles-repository";
import type {
  AiMode,
  AiRecommendationResponse,
  ArticleExtractionResult,
  ArticlePolishResult,
  HistoryEntry,
  TopicRecommendation,
} from "@/lib/types";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_RECOMMENDATION_ENTRIES = 12;
const MAX_EXTRA_CONTEXT_ITEMS = 8;
const MAX_CONTEXT_ITEM_LENGTH = 320;
const DAILY_RECOMMENDATION_LOCK_TTL_MS = 45_000;
const DAILY_RECOMMENDATION_WAIT_MS = 6_000;
const DAILY_RECOMMENDATION_POLL_INTERVAL_MS = 300;
const DAILY_RECOMMENDATION_MAX_LOCK_ATTEMPTS = 3;

type RecommendationRequest = {
  userId: string;
  authIdToken: string;
  prompt?: string;
  entries: HistoryEntry[];
  extraContext?: string[];
  maxRecommendations?: number;
};

type JsonObject = Record<string, unknown>;
type StoredDailyRecommendationStatus = "pending" | "ready" | "failed";

type StoredDailyRecommendation = {
  dateKey: string;
  status: StoredDailyRecommendationStatus;
  lockOwner?: string;
  lockUntilMs?: number;
  prompt?: string;
  recommendation?: AiRecommendationResponse;
  createdAt?: string;
  updatedAt: string;
  generatedAt?: string;
  errorMessage?: string | null;
};

async function createFirebaseAiServerApp(authIdToken: string) {
  const projectId = requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const appId = requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID");
  const app = initializeServerApp(
    {
      apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
      appId,
      authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
      projectId,
      storageBucket: requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ?? undefined,
    },
    {
      authIdToken,
    },
  );
  const auth = getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new ApiError(401, "Unable to initialize Firebase AI auth context.");
  }
  return app;
}

function getAiBackend() {
  const backend = readEnv("FIREBASE_AI_BACKEND");
  if (backend === "agent-platform") {
    return new AgentPlatformBackend(readEnv("FIREBASE_AI_LOCATION") ?? "global");
  }
  return new GoogleAIBackend();
}

function getModelName() {
  return readEnv("FIREBASE_AI_MODEL") ?? DEFAULT_MODEL;
}

function getRecommendationPrompt(prompt?: string) {
  return prompt?.trim() || "Generate home-page recommendations for a memory journaling product.";
}

function getDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRandomJitterMs() {
  return Math.floor(Math.random() * 1000);
}

function getDailyRecommendationDoc(userId: string, dateKey: string) {
  return db().collection("users").doc(userId).collection("dailyRecommendations").doc(dateKey);
}

function isRecommendationPayload(value: unknown): value is AiRecommendationResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const object = value as Record<string, unknown>;
  return (
    typeof object.mode === "string" &&
    typeof object.contextSummary === "string" &&
    typeof object.cityRecommendation === "object" &&
    object.cityRecommendation !== null &&
    Array.isArray(object.topicRecommendations)
  );
}

function normalizeStoredRecommendation(data: StoredDailyRecommendation | undefined) {
  if (!data || data.status !== "ready") {
    return null;
  }
  return isRecommendationPayload(data.recommendation) ? data.recommendation : null;
}

type LockAttemptResult =
  | { state: "cached"; recommendation: AiRecommendationResponse }
  | { state: "acquired" }
  | { state: "waiting" };

async function acquireDailyRecommendationLock(
  userId: string,
  dateKey: string,
  lockOwner: string,
  prompt: string,
): Promise<LockAttemptResult> {
  const docRef = getDailyRecommendationDoc(userId, dateKey);
  return db().runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const data = snapshot.data() as StoredDailyRecommendation | undefined;

    const cached = normalizeStoredRecommendation(data);
    if (cached) {
      return { state: "cached", recommendation: cached } satisfies LockAttemptResult;
    }

    const lockUntilMs = typeof data?.lockUntilMs === "number" ? data.lockUntilMs : 0;
    const lockedByOtherRequest =
      data?.status === "pending" && lockUntilMs > nowMs && data.lockOwner !== lockOwner;
    if (lockedByOtherRequest) {
      return { state: "waiting" } satisfies LockAttemptResult;
    }

    const nextDoc: StoredDailyRecommendation = {
      dateKey,
      status: "pending",
      lockOwner,
      lockUntilMs: nowMs + DAILY_RECOMMENDATION_LOCK_TTL_MS,
      prompt,
      createdAt: data?.createdAt ?? nowIso,
      updatedAt: nowIso,
      ...(data?.recommendation !== undefined ? { recommendation: data.recommendation } : {}),
    };

    tx.set(docRef, nextDoc, { merge: true });
    return { state: "acquired" } satisfies LockAttemptResult;
  });
}

async function waitForDailyRecommendation(
  userId: string,
  dateKey: string,
  waitMs: number,
) {
  const docRef = getDailyRecommendationDoc(userId, dateKey);
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    const snapshot = await docRef.get();
    const data = snapshot.data() as StoredDailyRecommendation | undefined;
    const cached = normalizeStoredRecommendation(data);
    if (cached) {
      return cached;
    }
    await wait(DAILY_RECOMMENDATION_POLL_INTERVAL_MS);
  }

  return null;
}

async function storeDailyRecommendation(
  userId: string,
  dateKey: string,
  lockOwner: string,
  prompt: string,
  recommendation: AiRecommendationResponse,
) {
  const docRef = getDailyRecommendationDoc(userId, dateKey);
  const nowIso = new Date().toISOString();
  await docRef.set(
    {
      dateKey,
      status: "ready",
      lockOwner,
      lockUntilMs: Date.now(),
      prompt,
      recommendation,
      generatedAt: nowIso,
      updatedAt: nowIso,
      errorMessage: null,
    } satisfies StoredDailyRecommendation,
    { merge: true },
  );
}

async function storeDailyRecommendationFailure(
  userId: string,
  dateKey: string,
  lockOwner: string,
  error: unknown,
) {
  const docRef = getDailyRecommendationDoc(userId, dateKey);
  const nowIso = new Date().toISOString();
  await docRef.set(
    {
      dateKey,
      status: "failed",
      lockOwner,
      lockUntilMs: Date.now(),
      updatedAt: nowIso,
      errorMessage: error instanceof Error ? error.message : "Unknown recommendation error.",
    } satisfies StoredDailyRecommendation,
    { merge: true },
  );
}

function ensureObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(502, `Invalid ${label} returned by AI.`);
  }
  return value as JsonObject;
}

function readString(source: JsonObject, key: string, label: string) {
  const value = source[key];
  if (typeof value !== "string") {
    throw new ApiError(502, `Invalid ${label}.${key} returned by AI.`);
  }
  return value.trim();
}

function readNumber(source: JsonObject, key: string, label: string) {
  const value = source[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ApiError(502, `Invalid ${label}.${key} returned by AI.`);
  }
  return value;
}

function readStringArray(source: JsonObject, key: string, label: string) {
  const value = source[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ApiError(502, `Invalid ${label}.${key} returned by AI.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

async function generateStructuredJson<T>({
  authIdToken,
  systemInstruction,
  prompt,
  responseJsonSchema,
  temperature,
  validate,
}: {
  authIdToken: string;
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
  temperature: number;
  validate: (value: unknown) => T;
}) {
  const app = await createFirebaseAiServerApp(authIdToken);
  try {
    const ai = getAI(app, { backend: getAiBackend() });
    const model = getGenerativeModel(ai, {
      model: getModelName(),
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema,
        temperature,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) {
      throw new ApiError(502, "AI returned an empty response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(502, "AI returned invalid JSON.");
    }

    return validate(parsed);
  } finally {
    await deleteApp(app);
  }
}

function validatePolishResult(value: unknown): ArticlePolishResult {
  const object = ensureObject(value, "polish result");
  return {
    title: readString(object, "title", "polish result") || "Untitled",
    polishedText: readString(object, "polishedText", "polish result"),
    summary: readString(object, "summary", "polish result"),
    improvements: readStringArray(object, "improvements", "polish result"),
    tone: readString(object, "tone", "polish result"),
  };
}

function validateExtractionResult(value: unknown): ArticleExtractionResult {
  const object = ensureObject(value, "extraction result");
  return {
    summary: readString(object, "summary", "extraction result"),
    keywords: readStringArray(object, "keywords", "extraction result"),
    places: readStringArray(object, "places", "extraction result"),
    persons: readStringArray(object, "persons", "extraction result"),
    organizations: readStringArray(object, "organizations", "extraction result"),
    dates: readStringArray(object, "dates", "extraction result"),
    topic: readString(object, "topic", "extraction result") || "General Memory",
    tone: readString(object, "tone", "extraction result"),
    city: readString(object, "city", "extraction result") || "Unknown",
  };
}

function validateRecommendationResult(value: unknown): AiRecommendationResponse {
  const object = ensureObject(value, "recommendation result");
  const cityRecommendationObject = ensureObject(
    object.cityRecommendation,
    "recommendation result.cityRecommendation",
  );
  const rawTopicRecommendations = object.topicRecommendations;
  if (!Array.isArray(rawTopicRecommendations)) {
    throw new ApiError(502, "Invalid recommendation result.topicRecommendations returned by AI.");
  }

  const topicRecommendations: TopicRecommendation[] = rawTopicRecommendations.map((item, index) => {
    const recommendation = ensureObject(item, `recommendation result.topicRecommendations[${index}]`);
    return {
      id:
        readString(recommendation, "id", `recommendation result.topicRecommendations[${index}]`) ||
        `topic-${index + 1}`,
      title: readString(
        recommendation,
        "title",
        `recommendation result.topicRecommendations[${index}]`,
      ),
      reason: readString(
        recommendation,
        "reason",
        `recommendation result.topicRecommendations[${index}]`,
      ),
      confidence: Number(
        Math.max(
          0,
          Math.min(
            1,
            readNumber(
              recommendation,
              "confidence",
              `recommendation result.topicRecommendations[${index}]`,
            ),
          ),
        ).toFixed(2),
      ),
    };
  });

  return {
    mode: "llm",
    contextSummary: readString(object, "contextSummary", "recommendation result"),
    cityRecommendation: {
      city:
        readString(cityRecommendationObject, "city", "recommendation result.cityRecommendation") ||
        "Unknown",
      brief: readString(cityRecommendationObject, "brief", "recommendation result.cityRecommendation"),
      highlights: readStringArray(
        cityRecommendationObject,
        "highlights",
        "recommendation result.cityRecommendation",
      ),
      digest: {
        ingestedArticles: 0,
        topTopics: topicRecommendations.map((item) => item.title).slice(0, 3),
      },
    },
    topicRecommendations,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildNaivePolishResult(title: string, content: string, tone?: string): ArticlePolishResult {
  const polishedText = content
    .split(/\n+/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean)
    .join("\n\n");
  const extracted = buildNaiveAiExtracted(title, polishedText);

  return {
    title: title.trim() || "Untitled",
    polishedText: polishedText || content.trim(),
    summary: extracted.summary,
    improvements: [
      "Normalized repeated whitespace.",
      "Preserved the original chronology and details.",
      "Kept the wording concise for downstream extraction.",
    ],
    tone: tone?.trim() || extracted.tone || "reflective",
  };
}

function buildNaiveExtractionResult(title: string, content: string): ArticleExtractionResult {
  const extracted = buildNaiveAiExtracted(title, content);
  return {
    ...extracted,
    topic: inferTopicFromText(title, content),
    city: inferCityFromText(`${title} ${content}`),
  };
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function scoreEntryAgainstPrompt(entry: HistoryEntry, prompt: string) {
  const normalizedPrompt = prompt.toLowerCase();
  if (!normalizedPrompt) {
    return 0;
  }

  const searchable = searchableText(entry);
  return normalizedPrompt
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .reduce((score, token) => score + (searchable.includes(token) ? 1 : 0), 0);
}

function selectRecommendationEntries(entries: HistoryEntry[], prompt: string) {
  return [...entries]
    .sort((left, right) => {
      const scoreDelta =
        scoreEntryAgainstPrompt(right, prompt) - scoreEntryAgainstPrompt(left, prompt);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return Date.parse(right.articleTime) - Date.parse(left.articleTime);
    })
    .slice(0, MAX_RECOMMENDATION_ENTRIES);
}

function compactExtraContext(extraContext: string[]) {
  return extraContext
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_EXTRA_CONTEXT_ITEMS)
    .map((item) => truncate(item, MAX_CONTEXT_ITEM_LENGTH));
}

function buildRecommendationContext(entries: HistoryEntry[], extraContext: string[]) {
  const serializedEntries = entries.map((entry, index) => ({
    order: index + 1,
    id: entry.id,
    title: entry.title,
    city: entry.city,
    topic: entry.topic,
    articleTime: entry.articleTime,
    summary: entry.aiExtracted.summary,
    keywords: entry.aiExtracted.keywords,
    tags: entry.tags,
    excerpt: truncate(entry.content, MAX_CONTEXT_ITEM_LENGTH),
  }));

  return JSON.stringify(
    {
      historyEntries: serializedEntries,
      extraContext,
    },
    null,
    2,
  );
}

function buildNaiveRecommendationResponse(entries: HistoryEntry[]): AiRecommendationResponse {
  const cityRecommendation = buildNaiveCityRecommendation(entries);
  const topicRecommendations = buildNaiveTopicRecommendations(entries);
  return {
    mode: "naive",
    contextSummary: entries.length
      ? `Built from ${entries.length} memory entr${entries.length > 1 ? "ies" : "y"}.`
      : "No history entries yet.",
    cityRecommendation,
    topicRecommendations,
  };
}

export async function polishMemoryArticle(
  mode: AiMode,
  input: { title?: string; content: string; tone?: string },
  authIdToken: string,
) {
  const title = input.title?.trim() ?? "";
  const content = input.content.trim();

  if (mode === "naive") {
    return buildNaivePolishResult(title, content, input.tone);
  }

  return generateStructuredJson({
    authIdToken,
    systemInstruction:
      "You polish short memory articles for a journaling app. Preserve facts, sequence, proper nouns, and emotional intent. Do not fabricate details. Return only valid JSON.",
    prompt: [
      "Rewrite the following short memory article into cleaner, more fluent prose.",
      "Keep it concise, first-person, and natural.",
      input.tone?.trim() ? `Preferred tone: ${input.tone.trim()}` : "Preferred tone: reflective and warm.",
      `Original title: ${title || "Untitled"}`,
      `Original content:\n${content}`,
    ].join("\n\n"),
    responseJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "polishedText", "summary", "improvements", "tone"],
      properties: {
        title: { type: "string" },
        polishedText: { type: "string" },
        summary: { type: "string" },
        improvements: {
          type: "array",
          items: { type: "string" },
          maxItems: 5,
        },
        tone: { type: "string" },
      },
    },
    temperature: 0.2,
    validate: validatePolishResult,
  });
}

export async function extractMemoryArticle(
  mode: AiMode,
  input: { title?: string; content: string },
  authIdToken: string,
) {
  const title = input.title?.trim() ?? "";
  const content = input.content.trim();

  if (mode === "naive") {
    return buildNaiveExtractionResult(title, content);
  }

  return generateStructuredJson({
    authIdToken,
    systemInstruction:
      "You extract structured metadata from short memory articles for a journaling app. Use only the provided content. If a field is absent, return an empty array or 'Unknown'. Return only valid JSON.",
    prompt: [
      "Extract structured information from the following short memory article.",
      `Title: ${title || "Untitled"}`,
      `Content:\n${content}`,
    ].join("\n\n"),
    responseJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "keywords",
        "places",
        "persons",
        "organizations",
        "dates",
        "topic",
        "tone",
        "city",
      ],
      properties: {
        summary: { type: "string" },
        keywords: { type: "array", items: { type: "string" }, maxItems: 8 },
        places: { type: "array", items: { type: "string" }, maxItems: 8 },
        persons: { type: "array", items: { type: "string" }, maxItems: 8 },
        organizations: { type: "array", items: { type: "string" }, maxItems: 8 },
        dates: { type: "array", items: { type: "string" }, maxItems: 8 },
        topic: { type: "string" },
        tone: { type: "string" },
        city: { type: "string" },
      },
    },
    temperature: 0.1,
    validate: validateExtractionResult,
  });
}

export async function recommendFromHistory(mode: AiMode, request: RecommendationRequest) {
  const prompt = getRecommendationPrompt(request.prompt);
  const selectedEntries = selectRecommendationEntries(request.entries, prompt);
  const extraContext = compactExtraContext(request.extraContext ?? []);
  const dateKey = getDateKey();
  const lockOwner = `${request.userId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await wait(getRandomJitterMs());

  for (let attempt = 0; attempt < DAILY_RECOMMENDATION_MAX_LOCK_ATTEMPTS; attempt += 1) {
    const lockResult = await acquireDailyRecommendationLock(
      request.userId,
      dateKey,
      lockOwner,
      prompt,
    );

    if (lockResult.state === "cached") {
      return lockResult.recommendation;
    }

    if (lockResult.state === "waiting") {
      const existing = await waitForDailyRecommendation(
        request.userId,
        dateKey,
        DAILY_RECOMMENDATION_WAIT_MS,
      );
      if (existing) {
        return existing;
      }
      continue;
    }

    try {
      const recommendation =
        mode === "naive"
          ? buildNaiveRecommendationResponse(selectedEntries)
          : await generateStructuredJson({
              authIdToken: request.authIdToken,
              systemInstruction:
                "You generate recommendations for a memory journaling homepage. Base every recommendation strictly on the supplied user history and context. Prefer specific, grounded reasons over generic advice. Return only valid JSON.",
              prompt: [
                `User intent: ${prompt}`,
                `Maximum topic recommendations: ${request.maxRecommendations ?? 5}`,
                "Use the supplied context bundle only. Do not invent places, events, or user preferences.",
                "Context bundle:",
                buildRecommendationContext(selectedEntries, extraContext),
              ].join("\n\n"),
              responseJsonSchema: {
                type: "object",
                additionalProperties: false,
                required: ["contextSummary", "cityRecommendation", "topicRecommendations"],
                properties: {
                  contextSummary: { type: "string" },
                  cityRecommendation: {
                    type: "object",
                    additionalProperties: false,
                    required: ["city", "brief", "highlights"],
                    properties: {
                      city: { type: "string" },
                      brief: { type: "string" },
                      highlights: {
                        type: "array",
                        items: { type: "string" },
                        maxItems: 5,
                      },
                    },
                  },
                  topicRecommendations: {
                    type: "array",
                    maxItems: request.maxRecommendations ?? 5,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["id", "title", "reason", "confidence"],
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        reason: { type: "string" },
                        confidence: { type: "number" },
                      },
                    },
                  },
                },
              },
              temperature: 0.3,
              validate: validateRecommendationResult,
            });

      const finalRecommendation: AiRecommendationResponse = {
        ...recommendation,
        cityRecommendation: {
          ...recommendation.cityRecommendation,
          digest: {
            ingestedArticles: selectedEntries.length,
            topTopics: recommendation.topicRecommendations.map((item) => item.title).slice(0, 3),
          },
        },
        mode,
      };

      await storeDailyRecommendation(
        request.userId,
        dateKey,
        lockOwner,
        prompt,
        finalRecommendation,
      );
      return finalRecommendation;
    } catch (error) {
      await storeDailyRecommendationFailure(request.userId, dateKey, lockOwner, error);
      throw error;
    }
  }

  throw new ApiError(503, "Daily recommendation is being generated. Please retry shortly.");
}
