export type AiMode = "naive" | "llm";

export type ArticleSortBy = "articleTime" | "createTime" | "topic" | "title";

export interface ArticleAiExtracted {
  summary: string;
  keywords: string[];
  places: string[];
  persons?: string[];
  organizations?: string[];
  dates?: string[];
  tone?: string;
}

export interface ArticleDraft {
  title: string;
  content: string;
  imageUrls: string[];
  articleTime?: string;
  useAiFineTune: boolean;
  city?: string;
  topic?: string;
  tags?: string[];
  aiExtracted?: ArticleAiExtracted;
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
  confidence?: number;
}

export interface PlaceDigest {
  city: string;
  articleCount: number;
  avatars: string[];
  topics: string[];
}

export interface CityArticleCount {
  city: string;
  articleCount: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  city: string;
  topic: string;
  tags: string[];
  content: string;
  imageUrls: string[];
  aiExtracted: ArticleAiExtracted;
  articleTime: string;
  createTime: string;
}

export interface ArticlePolishResult {
  title: string;
  polishedText: string;
  summary: string;
  improvements: string[];
  tone: string;
}

export interface ArticleExtractionResult extends ArticleAiExtracted {
  topic: string;
  city: string;
}

export interface AiRecommendationResponse {
  mode: AiMode;
  contextSummary: string;
  cityRecommendation: CityRecommendation;
  topicRecommendations: TopicRecommendation[];
}
