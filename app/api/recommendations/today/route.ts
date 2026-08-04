import { NextResponse } from "next/server";
import { todayCityRecommendation } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(todayCityRecommendation);
}
