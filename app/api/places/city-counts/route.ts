import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/api-error";
import { requireSession } from "@/lib/server/auth-session";
import { getAllCityArticleCounts } from "@/lib/server/repositories/articles-repository";

export async function GET() {
  try {
    const session = await requireSession();
    const counts = await getAllCityArticleCounts(session.userId);
    return NextResponse.json({ counts });
  } catch (error) {
    return errorResponse(error);
  }
}
