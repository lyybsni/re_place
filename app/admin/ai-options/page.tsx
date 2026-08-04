"use client";

import { useEffect, useState } from "react";
import type { AiMode } from "@/lib/types";

export default function AdminAiOptionsPage() {
  const [mode, setMode] = useState<AiMode>("llm");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMode() {
      const response = await fetch("/api/admin/ai-options");
      if (!response.ok) {
        setMessage("Failed to load AI mode.");
        setIsLoading(false);
        return;
      }
      const data = (await response.json()) as { mode: AiMode };
      setMode(data.mode);
      setIsLoading(false);
    }

    void loadMode();
  }, []);

  async function saveMode(nextMode: AiMode) {
    if (isSaving || mode === nextMode) {
      return;
    }

    const previousMode = mode;
    setMode(nextMode);
    setIsSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/ai-options", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: nextMode }),
    });

    const data = (await response.json()) as { mode?: AiMode; message?: string };
    if (data.mode) {
      setMode(data.mode);
      setMessage(`Saved mode: ${data.mode}`);
      setIsSaving(false);
      return;
    }
    setMode(previousMode);
    setMessage(data.message ?? "Failed to save mode.");
    setIsSaving(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6 lg:p-8">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-900/20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Admin · AI Options
        </h1>
        <p className="mt-2 text-sm text-indigo-50">
          Choose the global inference strategy for memory APIs.
        </p>
      </header>

      <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-700">
          Switch between deterministic rules and LLM-enhanced processing.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => saveMode("naive")}
            disabled={isSaving || isLoading}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              mode === "naive"
                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <p className="font-semibold">Naive</p>
            <p className="mt-1 text-xs opacity-80">
              Rule-based behavior with predictable output.
            </p>
          </button>
          <button
            type="button"
            onClick={() => saveMode("llm")}
            disabled={isSaving || isLoading}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              mode === "llm"
                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <p className="font-semibold">LLM</p>
            <p className="mt-1 text-xs opacity-80">
              Model-driven behavior for richer extracted context.
            </p>
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          {isLoading
            ? "Loading current mode..."
            : message || `Current mode: ${mode}`}
        </p>
      </section>
    </main>
  );
}
