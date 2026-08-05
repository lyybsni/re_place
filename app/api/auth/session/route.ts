import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/auth-cookies";
import {
  FirebaseAuthError,
  refreshIdToken,
  verifyIdToken,
} from "@/lib/server/firebase-auth";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const session = await verifyIdToken(accessToken);
    return NextResponse.json({
      authenticated: true,
      user: {
        userId: session.userId,
        email: session.email,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    if (!(error instanceof FirebaseAuthError) || !refreshToken) {
      const response = NextResponse.json({ authenticated: false });
      clearAuthCookies(response);
      return response;
    }

    try {
      const refreshed = await refreshIdToken(refreshToken);
      const expiresInSeconds = Number.parseInt(refreshed.expires_in, 10);
      if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
        const response = NextResponse.json({ authenticated: false });
        clearAuthCookies(response);
        return response;
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
    } catch {
      const response = NextResponse.json({ authenticated: false });
      clearAuthCookies(response);
      return response;
    }
  }
}
