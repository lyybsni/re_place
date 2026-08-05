type FirebaseErrorPayload = {
  error?: {
    message?: string;
  };
};

type FirebaseTokenInfo = {
  user_id?: string;
  sub?: string;
  email?: string;
  exp?: number;
};

export type FirebaseAuthSession = {
  userId: string;
  email: string;
  expiresAt: number;
};

type FirebaseSignInResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
};

type FirebaseRefreshResponse = {
  id_token: string;
  refresh_token: string;
  expires_in: string;
};

export class FirebaseAuthError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function getFirebaseApiKey() {
  const apiKey =
    readEnv("FIREBASE_API_KEY") ?? readEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!apiKey) {
    throw new FirebaseAuthError("FIREBASE_API_KEY is not configured.", 500);
  }
  return apiKey;
}

function mapFirebaseErrorMessage(code: string) {
  if (
    code === "INVALID_LOGIN_CREDENTIALS" ||
    code === "INVALID_PASSWORD" ||
    code === "EMAIL_NOT_FOUND"
  ) {
    return { status: 401, message: "Invalid email or password." };
  }
  if (code === "USER_DISABLED") {
    return { status: 403, message: "This user account is disabled." };
  }
  if (code === "INVALID_IDP_RESPONSE" || code === "INVALID_ID_TOKEN") {
    return { status: 401, message: "Invalid Google sign-in token." };
  }
  if (code === "TOKEN_EXPIRED") {
    return { status: 401, message: "Authentication token has expired." };
  }
  if (code === "INVALID_REFRESH_TOKEN") {
    return { status: 401, message: "Refresh token is invalid." };
  }
  if (code === "CREDENTIAL_TOO_OLD_LOGIN_AGAIN") {
    return { status: 401, message: "Please log in again." };
  }
  return { status: 502, message: `Firebase auth failed: ${code}` };
}

async function parseFirebaseError(response: Response): Promise<never> {
  let payload: FirebaseErrorPayload | null;
  try {
    payload = (await response.json()) as FirebaseErrorPayload;
  } catch {
    payload = null;
  }
  const code = payload?.error?.message ?? `HTTP_${response.status}`;
  const mapped = mapFirebaseErrorMessage(code);
  throw new FirebaseAuthError(mapped.message, mapped.status);
}

async function firebasePost<T>(path: string, body: object): Promise<T> {
  const apiKey = getFirebaseApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    await parseFirebaseError(response);
  }
  return (await response.json()) as T;
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
) {
  return firebasePost<FirebaseSignInResponse>("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

export async function signInWithGoogleIdToken(idToken: string) {
  const authDomain =
    readEnv("FIREBASE_AUTH_DOMAIN") ?? readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  const requestUri =
    authDomain && authDomain.length > 0
      ? `https://${authDomain}/auth/callback`
      : "http://localhost";

  return firebasePost<FirebaseSignInResponse>("accounts:signInWithIdp", {
    requestUri,
    postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
    returnSecureToken: true,
    returnIdpCredential: true,
  });
}

export async function refreshIdToken(refreshToken: string) {
  const apiKey = getFirebaseApiKey();
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    },
  );
  if (!response.ok) {
    await parseFirebaseError(response);
  }
  return (await response.json()) as FirebaseRefreshResponse;
}

export async function verifyIdToken(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${getFirebaseApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) {
    await parseFirebaseError(response);
  }

  const payload = (await response.json()) as {
    users?: Array<{ localId?: string; email?: string }>;
  };
  const user = payload.users?.[0];
  if (!user?.localId || !user.email) {
    throw new FirebaseAuthError("Unable to resolve user from ID token.", 401);
  }

  const tokenInfo = decodeJwtPayload(idToken);
  if (!tokenInfo.exp) {
    throw new FirebaseAuthError("Missing token expiry.", 401);
  }

  return {
    userId: user.localId,
    email: user.email,
    expiresAt: tokenInfo.exp,
  } satisfies FirebaseAuthSession;
}

function decodeJwtPayload(idToken: string): FirebaseTokenInfo {
  const parts = idToken.split(".");
  if (parts.length < 2) {
    throw new FirebaseAuthError("Malformed authentication token.", 401);
  }

  const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padLength = raw.length % 4 === 0 ? 0 : 4 - (raw.length % 4);
  const padded = raw + "=".repeat(padLength);
  const decoded = Buffer.from(padded, "base64").toString("utf8");
  const payload = JSON.parse(decoded) as FirebaseTokenInfo & { exp?: number };

  const expNumeric =
    typeof payload.exp === "number"
      ? payload.exp
      : Number.parseInt(payload.exp ?? "", 10);
  if (!Number.isFinite(expNumeric)) {
    throw new FirebaseAuthError("Invalid token expiry.", 401);
  }

  return {
    user_id: payload.user_id,
    sub: payload.sub,
    email: payload.email,
    exp: expNumeric,
  };
}
import { readEnv } from "@/lib/server/env";
