import type { AiMode } from "@/lib/types";
import { ApiError } from "@/lib/server/api-error";
import { db } from "@/lib/server/firebase-admin";

const AI_OPTIONS_DOC_PATH = "system/aiOptions";

export async function getAiMode() {
  const snapshot = await db().doc(AI_OPTIONS_DOC_PATH).get();
  const mode = snapshot.data()?.mode as AiMode | undefined;
  if (mode === "naive" || mode === "llm") {
    return mode;
  }
  return "llm";
}

export async function updateAiMode(mode: unknown) {
  if (mode !== "naive" && mode !== "llm") {
    throw new ApiError(400, "mode must be 'naive' or 'llm'");
  }

  await db()
    .doc(AI_OPTIONS_DOC_PATH)
    .set({ mode, updatedAt: new Date().toISOString() }, { merge: true });
  return mode;
}
