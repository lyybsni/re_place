import { NextResponse } from "next/server";
import type { AiMode } from "@/lib/types";

let mode: AiMode = "llm";

export async function GET() {
  return NextResponse.json({ mode });
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as { mode?: AiMode };

  if (payload.mode !== "naive" && payload.mode !== "llm") {
    return NextResponse.json(
      { message: "mode must be 'naive' or 'llm'" },
      { status: 400 },
    );
  }

  mode = payload.mode;
  return NextResponse.json({ mode });
}
