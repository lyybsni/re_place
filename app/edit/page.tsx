"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArticleDraft } from "@/lib/types";

const MAX_IMAGES = 3;
const MAX_CHARS = 600;

type LocalImage = {
  file: File;
  previewUrl: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export default function EditPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<Array<LocalImage | null>>([
    null,
    null,
    null,
  ]);
  const [useAiFineTune, setUseAiFineTune] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const imagesRef = useRef<Array<LocalImage | null>>([null, null, null]);

  const contentLength = useMemo(() => [...content].length, [content]);
  const overLimit = contentLength > MAX_CHARS;

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => {
        if (item) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  async function submitArticle() {
    if (isSubmitting) {
      return;
    }
    if (overLimit) {
      setSubmitMessage(`At most ${MAX_CHARS} characters are allowed.`);
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    const localImages = images.filter((item): item is LocalImage => item !== null);
    const encodedImages = await Promise.all(
      localImages.map(async (item) => readFileAsDataUrl(item.file)),
    );

    const payload: ArticleDraft = {
      title: title.trim(),
      content,
      imageUrls: encodedImages,
      useAiFineTune,
    };

    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };
      setSubmitMessage(data.message ?? "Submitted.");
    } finally {
      setIsSubmitting(false);
    }
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

  function clearImage(index: number) {
    setImages((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      next[index] = null;
      return next;
    });
    const inputRef = fileInputRefs.current[index];
    if (inputRef) {
      inputRef.value = "";
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 lg:p-8">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-900/20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Edit</h1>
        <p className="mt-2 text-sm text-indigo-50">
          Draft your memory article and attach up to three images.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="space-y-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full border-0 text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Untitled"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[360px] w-full resize-none border-0 text-base leading-7 text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Start writing your memory..."
            />
            <p
              className={`text-xs ${overLimit ? "text-rose-600" : "text-slate-500"}`}
            >
              Characters: {contentLength}/{MAX_CHARS}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={useAiFineTune}
                  onChange={(event) => setUseAiFineTune(event.target.checked)}
                />
                Use AI for fine-tuning text
              </label>
              <button
                type="button"
                className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={submitArticle}
                disabled={isSubmitting || overLimit}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
              {submitMessage ? (
                <p className="text-sm text-slate-600">{submitMessage}</p>
              ) : null}
            </div>
          </div>
        </article>

        <aside className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="font-semibold text-indigo-900">Images</h2>
          <p className="mt-1 text-xs text-slate-500">
            Up to {MAX_IMAGES}. Files stay local until you submit.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {Array.from({ length: MAX_IMAGES }).map((_, index) => {
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
                          onClick={() => clearImage(index)}
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
        </aside>
      </section>
    </main>
  );
}
