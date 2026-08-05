import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/server/auth-cookies";
import {
  FirebaseAuthError,
  signInWithEmailPassword,
  signInWithGoogleIdToken,
  verifyIdToken,
} from "@/lib/server/firebase-auth";

type LoginRequest =
  | {
      provider: "email";
      email?: string;
      password?: string;
    }
  | {
      provider: "google";
      idToken?: string;
    };

export async function POST(request: Request) {
  let payload: LoginRequest;
  try {
    payload = (await request.json()) as LoginRequest;
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    let signInResult: Awaited<ReturnType<typeof signInWithEmailPassword>> | null =
      null;
    if (payload.provider === "email") {
      const email = payload.email?.trim() ?? "";
      const password = payload.password ?? "";
      if (!email || !password) {
        return NextResponse.json(
          { message: "email and password are required." },
          { status: 400 },
        );
      }
      signInResult = await signInWithEmailPassword(email, password);
    } else if (payload.provider === "google") {
      const idToken = payload.idToken ?? "";
      if (!idToken) {
        return NextResponse.json(
          { message: "idToken is required for Google login." },
          { status: 400 },
        );
      }
      signInResult = await signInWithGoogleIdToken(idToken);
    }

    if (!signInResult) {
      return NextResponse.json(
        { message: "provider must be 'email' or 'google'." },
        { status: 400 },
      );
    }

    const expiresInSeconds = Number.parseInt(signInResult.expiresIn, 10);
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      return NextResponse.json(
        { message: "Invalid token expiry returned by Firebase." },
        { status: 502 },
      );
    }

    const session = await verifyIdToken(signInResult.idToken);
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
      signInResult.idToken,
      signInResult.refreshToken,
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
