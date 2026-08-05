"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionResponse =
  | {
      authenticated: true;
      user: {
        userId: string;
        email: string;
      };
      expiresAt: number;
    }
  | {
      authenticated: false;
    };

export default function AuthHeader() {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function loadSession() {
    setIsLoading(true);
    const response = await fetch("/api/auth/session", { method: "GET" });
    if (!response.ok) {
      setSession({ authenticated: false });
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as SessionResponse;
    setSession(payload);
    setIsLoading(false);
  }

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    const handleAuthChanged = () => {
      void loadSession();
    };
    window.addEventListener("auth-changed", handleAuthChanged);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, []);

  async function logout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    window.dispatchEvent(new Event("auth-changed"));
    setIsLoggingOut(false);
  }

  return (
    <header className="border-b border-indigo-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-3 lg:px-8">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-800">Auth:</span>
          {isLoading ? (
            <span className="text-slate-500">Loading...</span>
          ) : session.authenticated ? (
            <span className="text-emerald-700">{session.user.email}</span>
          ) : (
            <span className="text-slate-500">Guest</span>
          )}
        </div>

        {session.authenticated ? (
          <button
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        ) : (
          <Link
            href="/login"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
