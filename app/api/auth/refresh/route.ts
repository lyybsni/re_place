import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Token refresh endpoint skeleton." },
    { status: 501 },
  );
}
