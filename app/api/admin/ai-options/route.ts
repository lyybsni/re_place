import { NextResponse } from "next/server";
import type { AiMode } from "@/lib/types";
import { errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import { getAiMode, updateAiMode } from "@/lib/server/repositories/admin-repository";

export async function GET() {
  try {
    await requireSession();
    const mode = await getAiMode();
    return NextResponse.json({ mode });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSession();
    const payload = (await request.json()) as { mode?: AiMode };
    const mode = await updateAiMode(payload.mode);
    return NextResponse.json({ mode });
  } catch (error) {
    return errorResponse(error);
  }
}
