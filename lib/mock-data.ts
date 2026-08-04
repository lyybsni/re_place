import type {
  CityRecommendation,
  HistoryEntry,
  PlaceDigest,
  TopicRecommendation,
} from "@/lib/types";

export const todayCityRecommendation: CityRecommendation = {
  city: "Hangzhou",
  brief: "A balanced city for lake-side reflection, tea culture, and modern creativity.",
  highlights: ["West Lake", "Longjing Tea Fields", "Xixi Wetland"],
  digest: {
    ingestedArticles: 28,
    topTopics: ["Tea Culture", "Nature Walk", "City Memory"],
  },
};

export const todayTopicRecommendations: TopicRecommendation[] = [
  {
    id: "memory-food",
    title: "Food Memory",
    reason: "Your recent entries frequently mention signature dishes.",
  },
  {
    id: "city-night",
    title: "Night Walk",
    reason: "Strong overlap with your latest place tags.",
  },
  {
    id: "museum-route",
    title: "Museum Route",
    reason: "Fits your historical-content preference profile.",
  },
  {
    id: "bookstore-corner",
    title: "Independent Bookstores",
    reason: "Related to your reflective writing patterns.",
  },
];

export const placeDigests: Record<string, PlaceDigest> = {
  hangzhou: {
    city: "Hangzhou",
    articleCount: 12,
    avatars: ["RL", "WM", "YC", "LT"],
    topics: ["West Lake", "Tea", "City Walk"],
  },
  shanghai: {
    city: "Shanghai",
    articleCount: 9,
    avatars: ["RL", "XY", "QQ"],
    topics: ["Architecture", "Cafe", "Riverside"],
  },
  chengdu: {
    city: "Chengdu",
    articleCount: 7,
    avatars: ["RL", "AA", "PP"],
    topics: ["Food", "Parks", "Leisure"],
  },
};

export const historyEntries: HistoryEntry[] = [
  {
    id: "article-001",
    title: "Morning beside West Lake",
    city: "Hangzhou",
    topic: "Nature Walk",
    tags: ["lake", "morning", "tea"],
    content:
      "I walked along the Su Causeway before 10am. The water had a soft silver sheen and the willow trees made everything slower. I ended with a cup of Longjing near the shore and wrote down three details I never want to forget.",
    imageUrls: [
      "https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=900&q=80",
    ],
    aiExtracted: {
      summary:
        "A reflective lakeside morning focused on sensory details and calm pacing.",
      keywords: ["West Lake", "Longjing", "willow trees"],
      places: ["Su Causeway", "West Lake"],
    },
    articleTime: "2026-08-01T09:30:00.000Z",
    createTime: "2026-08-01T12:00:00.000Z",
  },
  {
    id: "article-002",
    title: "Old Street Bookstore Notes",
    city: "Shanghai",
    topic: "Independent Bookstores",
    tags: ["books", "heritage street", "coffee"],
    content:
      "Spent the afternoon in a tiny bookstore on Duolun Road. The owner arranged essays and city-history books by neighborhood rather than genre, which made browsing feel like walking the city itself.",
    imageUrls: [
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
    ],
    aiExtracted: {
      summary:
        "An urban memory entry about independent bookstores and neighborhood storytelling.",
      keywords: ["Duolun Road", "bookstore curation", "city history"],
      places: ["Duolun Road"],
    },
    articleTime: "2026-07-31T13:00:00.000Z",
    createTime: "2026-08-02T08:20:00.000Z",
  },
  {
    id: "article-003",
    title: "Spicy Memory in Chengdu",
    city: "Chengdu",
    topic: "Food Memory",
    tags: ["hotpot", "friends", "night"],
    content:
      "We queued for almost an hour for a local hotpot place. The broth was richer than expected and everyone kept adding side dishes. I mostly remember the laughter and the heat in the air when we stepped outside.",
    imageUrls: [
      "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80",
    ],
    aiExtracted: {
      summary:
        "A social food memory centered on atmosphere, waiting, and shared experience.",
      keywords: ["hotpot", "night dining", "group memory"],
      places: ["Chengdu old district"],
    },
    articleTime: "2026-08-03T10:40:00.000Z",
    createTime: "2026-08-03T15:10:00.000Z",
  },
];
