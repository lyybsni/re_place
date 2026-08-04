"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArticleSortBy, HistoryEntry } from "@/lib/types";

export default function HistoryPage() {
  const [sortBy, setSortBy] = useState<ArticleSortBy>("createTime");
  const [searchText, setSearchText] = useState("");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadEntries() {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch(
        `/api/articles?sortBy=${sortBy}&search=${encodeURIComponent(searchText.trim())}`,
      );
      if (!response.ok) {
        setErrorMessage("Failed to load history entries.");
        setIsLoading(false);
        return;
      }
      const data = (await response.json()) as { entries: HistoryEntry[] };
      setEntries(data.entries);
      setIsLoading(false);
    }

    void loadEntries();
  }, [sortBy, searchText]);

  useEffect(() => {
    if (!entries.length) {
      setSelectedId(null);
      return;
    }

    const existing = selectedId && entries.some((entry) => entry.id === selectedId);
    if (!existing) {
      setSelectedId(entries[0].id);
    }
  }, [entries, selectedId]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 lg:p-8">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-900/20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          History
        </h1>
        <p className="mt-2 text-sm text-indigo-50">
          Search and review your stored place memories.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="space-y-3">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search title, content, or tags"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
            <label className="block text-sm text-slate-700">
              Sort by
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as ArticleSortBy)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="articleTime">Article time</option>
                <option value="createTime">Create time</option>
                <option value="topic">Topic</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : null}
            {errorMessage ? (
              <p className="text-sm text-rose-600">{errorMessage}</p>
            ) : null}
            {!isLoading && !entries.length ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                No articles found.
              </p>
            ) : null}
            {entries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === entry.id
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <p className="font-medium text-slate-800">{entry.title}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {entry.city} · {entry.topic}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Article: {new Date(entry.articleTime).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-2">
          {selectedEntry ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {selectedEntry.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedEntry.city} · {selectedEntry.topic}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Article time: {new Date(selectedEntry.articleTime).toLocaleString()} ·
                  Created: {new Date(selectedEntry.createTime).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedEntry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                {selectedEntry.content}
              </p>

              {selectedEntry.imageUrls.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedEntry.imageUrls.map((imageUrl, index) => (
                    <img
                      key={`${selectedEntry.id}-image-${index}`}
                      src={imageUrl}
                      alt={`${selectedEntry.title} image ${index + 1}`}
                      className="h-44 w-full rounded-xl border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  AI-extracted information
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  {selectedEntry.aiExtracted.summary}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Keywords: {selectedEntry.aiExtracted.keywords.join(", ")}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Places: {selectedEntry.aiExtracted.places.join(", ")}
                </p>
              </section>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Select an article from the left list to view details.
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
