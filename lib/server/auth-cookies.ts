import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "rp_access_token";
export const REFRESH_TOKEN_COOKIE = "rp_refresh_token";

const ACCESS_COOKIE_MAX_AGE = 60 * 60;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: Math.max(1, Math.min(expiresInSeconds, ACCESS_COOKIE_MAX_AGE)),
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}
