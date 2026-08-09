"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ChinaDrilldownMap from "@/app/_components/china-drilldown-map";
import type {
  AiRecommendationResponse,
  CityRecommendation,
  PlaceDigest,
  TopicRecommendation,
} from "@/lib/types";

export default function HomeDashboard() {
  const [cityRecommendation, setCityRecommendation] =
    useState<CityRecommendation | null>(null);
  const [topics, setTopics] = useState<TopicRecommendation[]>([]);
  const [selectedCity, setSelectedCity] = useState("Hangzhou");
  const [placeDigest, setPlaceDigest] = useState<PlaceDigest | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Generate city and topic recommendations for the signed-in user's home dashboard.",
          maxRecommendations: 5,
        }),
      });

      if (response.ok) {
        const recommendation = (await response.json()) as AiRecommendationResponse;
        setCityRecommendation(recommendation.cityRecommendation);
        if (Array.isArray(recommendation.topicRecommendations)) {
          setTopics(recommendation.topicRecommendations.slice(0, 5) as TopicRecommendation[]);
        }
      }
    }

    void load();
  }, []);

  useEffect(() => {
    async function loadDigest() {
      const response = await fetch(
        `/api/places/digest?city=${encodeURIComponent(selectedCity)}`,
      );
      if (!response.ok) {
        return;
      }
      const digest = (await response.json()) as PlaceDigest;
      setPlaceDigest(digest);
    }

    void loadDigest();
  }, [selectedCity]);

  const normalizedTopics = useMemo(() => {
    if (topics.length < 3) {
      return topics;
    }
    return topics.slice(0, 5);
  }, [topics]);

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
              Articles: {cityRecommendation?.digest.ingestedArticles ?? 0}
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
          <h2 className="font-semibold text-indigo-900">Interactive China Map</h2>
          <p className="mt-2 text-sm text-slate-700">
            Click a province to drill down, then click a city to load place digest
            information.
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <ChinaDrilldownMap onCitySelectAction={setSelectedCity} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p>
              <span className="font-medium text-slate-800">City: </span>
              {placeDigest?.city ?? selectedCity}
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-800">Articles: </span>
              {placeDigest?.articleCount ?? 0}
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-800">Avatars: </span>
              {(placeDigest?.avatars ?? []).join(", ") || "None"}
            </p>
          </div>
        </article>
      </section>

    </main>
  );
}
