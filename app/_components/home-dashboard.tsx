"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChinaBlockMap from "@/app/_components/china-block-map";
import type {
  AiRecommendationResponse,
  CityArticleCount,
  CityRecommendation,
  PlaceDigest,
  TopicRecommendation,
} from "@/lib/types";

const digestCache = new Map<string, PlaceDigest>();
const digestInFlight = new Map<string, Promise<Map<string, PlaceDigest>>>();

async function fetchCityDigests(cities: readonly string[]): Promise<Map<string, PlaceDigest>> {
  const normalizedCities = Array.from(new Set(cities.map((city) => city.trim()).filter(Boolean)));
  const result = new Map<string, PlaceDigest>();
  if (normalizedCities.length === 0) {
    return result;
  }

  const missingCities: string[] = [];
  for (const city of normalizedCities) {
    const cached = digestCache.get(city);
    if (cached) {
      result.set(city, cached);
      continue;
    }
    missingCities.push(city);
  }

  if (missingCities.length === 0) {
    return result;
  }

  const inFlightKey = missingCities.slice().sort().join("|");
  const pending = digestInFlight.get(inFlightKey);
  const request =
    pending ??
    fetch("/api/places/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities: missingCities }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load place digests: ${response.status}`);
        }
        const payload = (await response.json()) as { digests?: PlaceDigest[] };
        const map = new Map<string, PlaceDigest>();
        for (const digest of payload.digests ?? []) {
          map.set(digest.city, digest);
        }
        return map;
      })
      .finally(() => {
        digestInFlight.delete(inFlightKey);
      });
  digestInFlight.set(inFlightKey, request);

  const fetched = await request;
  for (const [city, digest] of fetched) {
    digestCache.set(city, digest);
    result.set(city, digest);
  }

  return result;
}

export default function HomeDashboard() {
  const [cityRecommendation, setCityRecommendation] =
    useState<CityRecommendation | null>(null);
  const [topics, setTopics] = useState<TopicRecommendation[]>([]);
  const [selectedCity, setSelectedCity] = useState("Hangzhou");
  const [recommendedCityDigest, setRecommendedCityDigest] =
    useState<PlaceDigest | null>(null);
  const [cityArticleCounts, setCityArticleCounts] = useState<Record<string, number>>({});
  const [nearbyCityDigests, setNearbyCityDigests] = useState<PlaceDigest[]>([]);
  const [nearbyCityName, setNearbyCityName] = useState<string | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const nearbyRequestRef = useRef(0);

  useEffect(() => {
    async function load() {
      const [recommendationResult, countsResult] = await Promise.allSettled([
        fetch("/api/ai/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Generate city and topic recommendations for the signed-in user's home dashboard.",
            maxRecommendations: 5,
          }),
        }),
        fetch("/api/places/city-counts"),
      ]);

      if (recommendationResult.status === "fulfilled" && recommendationResult.value.ok) {
        const recommendation = (await recommendationResult.value.json()) as AiRecommendationResponse;
        setCityRecommendation(recommendation.cityRecommendation);
        if (Array.isArray(recommendation.topicRecommendations)) {
          setTopics(recommendation.topicRecommendations.slice(0, 5) as TopicRecommendation[]);
        }
      }

      if (countsResult.status === "fulfilled" && countsResult.value.ok) {
        const payload = (await countsResult.value.json()) as { counts?: CityArticleCount[] };
        const nextCounts: Record<string, number> = {};
        for (const item of payload.counts ?? []) {
          nextCounts[item.city] = item.articleCount;
        }
        setCityArticleCounts(nextCounts);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    async function loadRecommendedDigest() {
      if (!cityRecommendation?.city || cityRecommendation.city === "Unknown") {
        setRecommendedCityDigest(null);
        return;
      }

      try {
        const digestMap = await fetchCityDigests([cityRecommendation.city]);
        setRecommendedCityDigest(digestMap.get(cityRecommendation.city) ?? null);
      } catch {
        setRecommendedCityDigest(null);
      }
    }

    void loadRecommendedDigest();
  }, [cityRecommendation?.city]);

  const normalizedTopics = useMemo(() => {
    if (topics.length < 3) {
      return topics;
    }
    return topics.slice(0, 5);
  }, [topics]);

  const handleMapCitySelect = useCallback(
    async (city: string, nearbyCities: string[]) => {
      setSelectedCity(city);
      setNearbyCityName(city);
      setNearbyLoading(true);

      nearbyRequestRef.current += 1;
      const requestId = nearbyRequestRef.current;
      const targetCities = Array.from(new Set([city, ...nearbyCities]));
      try {
        const digestByCity = await fetchCityDigests(targetCities);
        if (requestId === nearbyRequestRef.current) {
          setCityArticleCounts((previous) => {
            const next = { ...previous };
            for (const [cityName, digest] of digestByCity) {
              next[cityName] = digest.articleCount;
            }
            return next;
          });
          setNearbyCityDigests(
            targetCities
              .map((targetCity) => digestByCity.get(targetCity) ?? null)
              .filter((digest): digest is PlaceDigest => Boolean(digest)),
          );
        }
      } catch {
        if (requestId === nearbyRequestRef.current) {
          setNearbyCityDigests([]);
        }
      } finally {
        if (requestId === nearbyRequestRef.current) {
          setNearbyLoading(false);
        }
      }
    },
    [],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 lg:p-8">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-900/20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Re:Place
        </h1>
        <p className="mt-2 text-sm text-indigo-50">
          Your Personal Memory Management Assistant
        </p>
      </header>

      <section className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-indigo-900">
              Today&apos;s Recommendation for the City
            </h2>
            <p className="mt-2 text-sm">
              <span className="font-semibold text-indigo-700">
                {cityRecommendation?.city ?? "—"}
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {cityRecommendation?.brief ?? "Loading recommendation..."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Articles: {recommendedCityDigest?.articleCount ?? "Loading..."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Top topics:{" "}
              {recommendedCityDigest?.topics.join(", ") || "Loading..."}
            </p>
          </article>

          <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-indigo-900">Topic Recommendation</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {normalizedTopics.map((topic) => (
                <li
                  key={topic.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="font-medium text-slate-800">{topic.title}</p>
                  <p className="text-xs text-slate-600">{topic.reason}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-indigo-900">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <Link
                className="flex items-center justify-between rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                href="/edit"
              >
                <span>Edit</span>
                <span aria-hidden="true">✍️</span>
              </Link>
              <Link
                className="flex items-center justify-between rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                href="/history"
              >
                <span>History</span>
                <span aria-hidden="true">🕘</span>
              </Link>
            </div>
          </article>
        </div>

        <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-semibold text-indigo-900">Interactive China Block Map</h2>
          <p className="mt-2 text-sm text-slate-700">
            Hover a block to inspect the likely city and its article count. Click a block to view nearby city digests.
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <ChinaBlockMap
              cityArticleCounts={cityArticleCounts}
              nearbyCityDigests={nearbyCityDigests}
              nearbyCityName={nearbyCityName}
              nearbyLoading={nearbyLoading}
              onCitySelectAction={handleMapCitySelect}
            />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p>
              <span className="font-medium text-slate-800">City: </span>
              {nearbyCityName ?? selectedCity}
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-800">Nearby digests loaded: </span>
              {nearbyCityDigests.length}
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-800">Status: </span>
              {nearbyLoading ? "Loading nearby digests..." : "Ready"}
            </p>
          </div>
        </article>
      </section>

    </main>
  );
}
