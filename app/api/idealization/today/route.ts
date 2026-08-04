import { NextResponse } from "next/server";
import { todayTopicRecommendations } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(todayTopicRecommendations.slice(0, 5));
}
