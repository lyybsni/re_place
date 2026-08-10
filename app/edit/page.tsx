"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArticleDraft, ArticleExtractionResult, ArticlePolishResult, HistoryEntry } from "@/lib/types";
import { PlaceTreeInput } from "@/components/place-tree-input";

const MAX_IMAGES = 3;
const MAX_CHARS = 600;

type LocalImage = {
  file: File;
  previewUrl: string;
};

type ReviewDraft = {
  title: string;
  content: string;
  summary: string;
  keywords: string;
  places: string;
  persons: string;
  organizations: string;
  dates: string;
  tone: string;
  city: string;
  topic: string;
  tags: string;
};

type ToastState = {
  kind: "success" | "error";
  message: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function splitValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinValues(values: string[] | undefined) {
  return values?.join(", ") ?? "";
}

function monthToIso(value: string) {
  return value ? `${value}-01T00:00:00.000Z` : undefined;
}

function isMetadataReady(draft: ReviewDraft) {
  return (
    draft.summary.trim() !== "" ||
    draft.keywords.trim() !== "" ||
    draft.places.trim() !== "" ||
    draft.persons.trim() !== "" ||
    draft.organizations.trim() !== "" ||
    draft.dates.trim() !== "" ||
    draft.tone.trim() !== ""
  );
}

function buildAiExtracted(draft: ReviewDraft): ArticleDraft["aiExtracted"] {
  if (!isMetadataReady(draft)) {
    return undefined;
  }

  return {
    summary:
      draft.summary.trim() ||
      draft.content.trim() ||
      draft.title.trim() ||
      "No summary available.",
    keywords: splitValues(draft.keywords),
    places: splitValues(draft.places),
    persons: splitValues(draft.persons),
    organizations: splitValues(draft.organizations),
    dates: splitValues(draft.dates),
    tone: draft.tone.trim() || "reflective",
  };
}

function normalizePlaceName(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s\u3000,，.。/\\|_-]+/g, "")
    .trim();
}

function findBestPlaceMatch(input: string, candidates: string[]) {
  const normalizedInput = normalizePlaceName(input);
  if (!normalizedInput) {
    return "";
  }

  return (
    candidates.find((candidate) => {
      const normalizedCandidate = normalizePlaceName(candidate);
      return (
        normalizedCandidate === normalizedInput ||
        normalizedCandidate.includes(normalizedInput) ||
        normalizedInput.includes(normalizedCandidate)
      );
    }) ?? ""
  );
}

export default function EditPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ReviewDraft>({
    title: "",
    content: "",
    summary: "",
    keywords: "",
    places: "",
    persons: "",
    organizations: "",
    dates: "",
    tone: "",
    city: "",
    topic: "",
    tags: "",
  });
  const [placeInput, setPlaceInput] = useState("");
  const [articleMonth, setArticleMonth] = useState("");
  const [images, setImages] = useState<Array<LocalImage | null>>([null, null, null]);
  const [useAiFineTune, setUseAiFineTune] = useState(false);
  const [previewBeforeUpload, setPreviewBeforeUpload] = useState(false);
  const [previewNote, setPreviewNote] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [knownEntries, setKnownEntries] = useState<HistoryEntry[]>([]);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const imagesRef = useRef<Array<LocalImage | null>>([null, null, null]);
  const redirectTimerRef = useRef<number | null>(null);

  const contentLength = useMemo(() => [...draft.content].length, [draft.content]);
  const overLimit = contentLength > MAX_CHARS;
  const visibleImageCount = useMemo(() => {
    const filledImageCount = images.filter((item): item is LocalImage => item !== null).length;
    return Math.min(MAX_IMAGES, filledImageCount + 1);
  }, [images]);

  const knownPlaces = useMemo(() => {
    const seen = new Set<string>();
    const places: string[] = [];

    for (const entry of knownEntries) {
      for (const value of [entry.city, ...entry.aiExtracted.places]) {
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed.toLowerCase())) {
          continue;
        }
        seen.add(trimmed.toLowerCase());
        places.push(trimmed);
      }
    }

    return places;
  }, [knownEntries]);
  const matchedPlace = useMemo(
    () => findBestPlaceMatch(placeInput, knownPlaces),
    [placeInput, knownPlaces],
  );
  const resolvedPlace = useMemo(() => matchedPlace || placeInput.trim(), [matchedPlace, placeInput]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    async function loadKnownPlaces() {
      const response = await fetch("/api/articles?sortBy=createTime&search=");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { entries?: HistoryEntry[] };
      if (Array.isArray(data.entries)) {
        setKnownEntries(data.entries);
      }
    }

    void loadKnownPlaces();
  }, []);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => {
        if (item) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  function pushToast(kind: ToastState["kind"], message: string) {
    setToast({ kind, message });
  }

  function patchDraft(patch: Partial<ReviewDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function replaceImage(index: number, file: File) {
    setImages((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      next[index] = {
        file,
        previewUrl: URL.createObjectURL(file),
      };
      return next;
    });
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      next.splice(index, 1);
      next.push(null);
      return next.slice(0, MAX_IMAGES);
    });
    const inputRef = fileInputRefs.current[index];
    if (inputRef) {
      inputRef.value = "";
    }
  }

  async function buildPreviewDraft() {
    if (isPreviewing || overLimit) {
      return;
    }

    setPreviewNote("");
    setIsPreviewing(true);
    try {
      let nextDraft = { ...draft };
      if (useAiFineTune) {
        const polishResponse = await fetch("/api/ai/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: nextDraft.title.trim(),
            content: nextDraft.content,
            tone: nextDraft.tone.trim() || undefined,
            city: resolvedPlace || undefined,
            articleTime: articleMonth || undefined,
          }),
        });
        const polishData = (await polishResponse.json()) as
          | (ArticlePolishResult & { extracted: ArticleExtractionResult })
          | { message?: string };

        if (!polishResponse.ok) {
          setPreviewNote("Preview generation failed.");
          const message = "message" in polishData ? polishData.message : undefined;
          pushToast("error", message ?? "Failed to generate AI polish preview.");
          return;
        }

        const result = polishData as ArticlePolishResult & { extracted: ArticleExtractionResult };
        nextDraft = {
          ...nextDraft,
          title: result.title || nextDraft.title,
          content: result.polishedText || nextDraft.content,
          summary: result.summary || nextDraft.summary,
          tone: result.tone || nextDraft.tone,
          keywords: joinValues(result.extracted.keywords),
          places: joinValues(result.extracted.places),
          persons: joinValues(result.extracted.persons ?? []),
          organizations: joinValues(result.extracted.organizations ?? []),
          dates: joinValues(result.extracted.dates ?? []),
          city: result.extracted.city || nextDraft.city,
          topic: result.extracted.topic || nextDraft.topic,
        };
      }

      const extractResponse = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextDraft.title.trim(),
          content: nextDraft.content,
          city: resolvedPlace || undefined,
          articleTime: articleMonth || undefined,
        }),
      });
      const extractData = (await extractResponse.json()) as ArticleExtractionResult | { message?: string };

      if (!extractResponse.ok) {
        setPreviewNote("Preview generation failed.");
        const message = "message" in extractData ? extractData.message : undefined;
        pushToast("error", message ?? "Failed to generate AI extract preview.");
        return;
      }

      const result = extractData as ArticleExtractionResult;
      patchDraft({
        ...nextDraft,
        summary: result.summary || nextDraft.summary,
        keywords: joinValues(result.keywords),
        places: joinValues(result.places),
        persons: joinValues(result.persons ?? []),
        organizations: joinValues(result.organizations ?? []),
        dates: joinValues(result.dates ?? []),
        tone: result.tone || nextDraft.tone,
        city: result.city || nextDraft.city,
        topic: result.topic || nextDraft.topic,
      });
      setIsPreviewOpen(true);
      setPreviewNote("Preview is ready in the modal.");
      pushToast("success", "Preview updated.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function submitArticle(options: { skipAiPolish?: boolean; skipAiExtraction?: boolean } = {}) {
    if (isSubmitting) {
      return;
    }
    if (overLimit) {
      setSubmitNote(`At most ${MAX_CHARS} characters are allowed.`);
      pushToast("error", `At most ${MAX_CHARS} characters are allowed.`);
      return;
    }

    setIsSubmitting(true);
    setSubmitNote("");

    const localImages = images.filter((item): item is LocalImage => item !== null);
    const encodedImages = await Promise.all(localImages.map(async (item) => readFileAsDataUrl(item.file)));

    const payload: ArticleDraft = {
      title: draft.title.trim(),
      content: draft.content,
      imageUrls: encodedImages,
      useAiFineTune: !options.skipAiPolish && useAiFineTune,
      articleTime: monthToIso(articleMonth),
      city: resolvedPlace || draft.city.trim() || undefined,
      topic: draft.topic.trim() || undefined,
      tags: splitValues(draft.tags),
      aiExtracted: buildAiExtracted(draft),
    };

    const requestBody = options.skipAiExtraction
      ? { ...payload, skipAiExtraction: true }
      : payload;

    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = data.message ?? "Upload failed.";
        setSubmitNote(message);
        pushToast("error", message);
        return;
      }

      const message = data.message ?? "Article created.";
      setSubmitNote(message);
      pushToast("success", `${message} Redirecting to history in 5 seconds.`);
      setIsPreviewOpen(false);
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        router.push("/history");
        router.refresh();
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadClick() {
    if (previewBeforeUpload) {
      await buildPreviewDraft();
      return;
    }

    await submitArticle();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 lg:p-8">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-900/20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Edit</h1>
        <p className="mt-2 text-sm text-indigo-50">
          Draft your memory article, validate AI metadata, and confirm the final upload.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="space-y-4">
            <input
              value={draft.title}
              onChange={(event) => patchDraft({ title: event.target.value })}
              className="w-full border-0 text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Untitled"
            />
            <div className="rounded-2xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section className="rounded-2xl sm:col-span-2">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-slate-700">
                      Place
                      <PlaceTreeInput
                        value={placeInput}
                        onChange={setPlaceInput}
                        placeholder="Select a province, city, or type a custom place"
                      />
                    </label>
                    <label className="block text-sm text-slate-700">
                      Month
                      <input
                        type="month"
                        value={articleMonth}
                        onChange={(event) => setArticleMonth(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono tabular-nums tracking-[0.14em] outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                  </div>
                </section>
              </div>
            </div>
            <textarea
              value={draft.content}
              onChange={(event) => patchDraft({ content: event.target.value })}
              className="min-h-[320px] w-full resize-none border-0 text-base leading-7 text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Start writing your memory..."
            />
            <p className={`text-xs ${overLimit ? "text-rose-600" : "text-slate-500"}`}>
              Characters: {contentLength}/{MAX_CHARS}
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="flex h-full flex-col">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-800">Picture uploading</h3>
                <p className="text-xs text-slate-500">
                  Add one image, then the next upload box appears for appending more pictures.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {Array.from({ length: visibleImageCount }).map((_, index) => {
                  const item = images[index];
                  return (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50"
                    >
                      <input
                        ref={(node) => {
                          fileInputRefs.current[index] = node;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) {
                            return;
                          }
                          replaceImage(index, file);
                        }}
                      />
                      {item ? (
                        <div className="relative">
                          <img
                            src={item.previewUrl}
                            alt={`Selected image ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-slate-900/60 px-2 py-1 text-[11px] text-white">
                            <span className="truncate pr-2">{item.file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[index]?.click()}
                          className="flex h-32 w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
                        >
                          <span className="text-lg leading-none">+</span>
                          <span>Upload image</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={useAiFineTune}
                    onChange={(event) => setUseAiFineTune(event.target.checked)}
                  />
                  Use AI for fine-tuning text
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={previewBeforeUpload}
                    onChange={(event) => setPreviewBeforeUpload(event.target.checked)}
                  />
                  Review before upload
                </label>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-6">
              <button
                type="button"
                className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleUploadClick}
                disabled={isPreviewing || isSubmitting || overLimit}
              >
                {isPreviewing
                  ? "Preparing preview..."
                  : isSubmitting
                    ? "Uploading..."
                    : previewBeforeUpload
                      ? "Preview and review"
                      : "Upload article"}
              </button>
            </div>
          </div>

          {previewNote ? <p className="mt-4 text-sm text-emerald-700">{previewNote}</p> : null}
          {submitNote ? <p className="mt-2 text-sm text-slate-600">{submitNote}</p> : null}
        </article>
      </section>

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Review before upload</h2>
                <p className="text-xs text-slate-500">Review and adjust the fields before uploading.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-129px)] grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-2">
              <div className="space-y-4 p-5">
                <label className="block text-sm text-slate-700">
                  Title
                  <input
                    value={draft.title}
                    onChange={(event) => patchDraft({ title: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Content
                  <textarea
                    value={draft.content}
                    onChange={(event) => patchDraft({ content: event.target.value })}
                    className="mt-1 min-h-40 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  Tone
                  <input
                    value={draft.tone}
                    onChange={(event) => patchDraft({ tone: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-slate-700">
                    City
                    <input
                      value={draft.city}
                      onChange={(event) => patchDraft({ city: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="block text-sm text-slate-700">
                    Topic
                    <input
                      value={draft.topic}
                      onChange={(event) => patchDraft({ topic: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                </div>
                <label className="block text-sm text-slate-700">
                  Tags
                  <input
                    value={draft.tags}
                    onChange={(event) => patchDraft({ tags: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <section className="rounded-2xl bg-slate-50/80 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Place and time</h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-medium">Place:</span> {resolvedPlace || "Not set"}
                    </p>
                    <p>
                      <span className="font-medium">Month:</span> {articleMonth || "Not set"}
                    </p>
                  </div>
                </section>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Summary</h3>
                    <textarea
                      value={draft.summary}
                      onChange={(event) => patchDraft({ summary: event.target.value })}
                      className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Structured metadata</h3>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {[
                        ["Keywords", "keywords"],
                        ["Places", "places"],
                        ["People", "persons"],
                        ["Organizations", "organizations"],
                        ["Dates", "dates"],
                      ].map(([label, key]) => (
                        <label key={key} className="block text-sm text-slate-700">
                          {label}
                          <input
                            value={draft[key as keyof ReviewDraft] as string}
                            onChange={(event) =>
                              patchDraft({ [key]: event.target.value } as Partial<ReviewDraft>)
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Preview hints</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use this modal to validate and edit the article metadata before uploading.
                      All edits here stay in the draft.
                    </p>
                  </section>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={() => submitArticle({ skipAiPolish: true, skipAiExtraction: true })}
                disabled={isSubmitting}
                className="rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Uploading..." : "Upload article"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-lg ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
