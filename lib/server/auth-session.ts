import {cookies} from "next/headers";
import {ApiError} from "@/lib/server/api-error";
import {ACCESS_TOKEN_COOKIE} from "@/lib/server/auth-cookies";
import {verifyIdToken} from "@/lib/server/firebase-auth";

export async function requireSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    throw new ApiError(401, "Authentication required.");
  }

  try {
    return await verifyIdToken(accessToken);
  } catch {
    throw new ApiError(401, "Invalid or expired authentication session.");
  }
}
