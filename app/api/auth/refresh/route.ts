import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_TOKEN_COOKIE, setAuthCookies } from "@/lib/server/auth-cookies";
import {
  FirebaseAuthError,
  refreshIdToken,
  verifyIdToken,
} from "@/lib/server/firebase-auth";

type RefreshRequest = {
  refreshToken?: string;
};

export async function POST(request: Request) {
  let payload: RefreshRequest | null;
  try {
    payload = (await request.json()) as RefreshRequest;
  } catch {
    payload = null;
  }

  const cookieStore = await cookies();
  const refreshToken =
    payload?.refreshToken?.trim() || cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: "Missing refresh token." }, { status: 401 });
  }

  try {
    const refreshed = await refreshIdToken(refreshToken);
    const expiresInSeconds = Number.parseInt(refreshed.expires_in, 10);
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      return NextResponse.json(
        { message: "Invalid token expiry returned by Firebase." },
        { status: 502 },
      );
    }

    const session = await verifyIdToken(refreshed.id_token);
    const response = NextResponse.json({
      authenticated: true,
      user: {
        userId: session.userId,
        email: session.email,
      },
      expiresAt: session.expiresAt,
    });

    setAuthCookies(
      response,
      refreshed.id_token,
      refreshed.refresh_token,
      expiresInSeconds,
    );
    return response;
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}
