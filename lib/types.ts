export type AiMode = "naive" | "llm";

export type ArticleSortBy = "articleTime" | "createTime" | "topic" | "title";

export interface ArticleDraft {
  title: string;
  content: string;
  imageUrls: string[];
  articleTime?: string;
  useAiFineTune: boolean;
}

export interface PlaceDigestQuery {
  city: string;
}

export interface CityRecommendation {
  city: string;
  brief: string;
  highlights: string[];
  digest: {
    ingestedArticles: number;
    topTopics: string[];
  };
}

export interface TopicRecommendation {
  id: string;
  title: string;
  reason: string;
}

export interface PlaceDigest {
  city: string;
  articleCount: number;
  avatars: string[];
  topics: string[];
}

export interface HistoryEntry {
  id: string;
  title: string;
  city: string;
  topic: string;
  tags: string[];
  content: string;
  imageUrls: string[];
  aiExtracted: {
    summary: string;
    keywords: string[];
    places: string[];
  };
  articleTime: string;
  createTime: string;
}
