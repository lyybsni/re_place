"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type LoginResponse = {
  authenticated?: boolean;
  message?: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (
      parent: HTMLElement,
      options: {
        type: "standard";
        theme: "outline" | "filled_blue";
        size: "large" | "medium";
        text: "signin_with";
      },
    ) => void;
  };
};

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleClientId = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "",
    [],
  );

  async function postLogin(payload: object) {
    setIsSubmitting(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as LoginResponse;

    if (!response.ok || !data.authenticated) {
      setMessage(data.message ?? "Login failed.");
      setIsSubmitting(false);
      return;
    }

    window.dispatchEvent(new Event("auth-changed"));
    router.push("/");
    router.refresh();
    setIsSubmitting(false);
  }

  function onGoogleScriptReady() {
    if (!googleClientId || !window.google || !googleButtonRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (!response.credential) {
          setMessage("Google did not return a credential.");
          return;
        }
        void postLogin({
          provider: "google",
          idToken: response.credential,
        });
      },
    });

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
    });
  }

  async function onEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setMessage("Please enter both email and password.");
      return;
    }

    await postLogin({
      provider: "email",
      email: normalizedEmail,
      password,
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={onGoogleScriptReady}
      />

      <h1 className="text-2xl font-semibold text-slate-900">Login</h1>
      <section className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm">
        <form onSubmit={onEmailLogin} className="space-y-3">
          <label className="block text-sm text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Logging in..." : "Login with Email"}
          </button>
        </form>

        <div className="my-4 border-t border-slate-200" />

        <div className="space-y-2">
          <p className="text-sm text-slate-700">Google Login</p>
          {googleClientId ? (
            <div ref={googleButtonRef} />
          ) : (
            <p className="text-sm text-amber-700">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.
            </p>
          )}
        </div>

        {message ? (
          <p className="mt-4 text-sm text-rose-600" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
