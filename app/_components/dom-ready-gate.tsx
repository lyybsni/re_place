"use client";

import { useEffect, useState } from "react";

type DomReadyGateProps = {
  children: React.ReactNode;
};

function AppLoadingFallback() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 lg:p-8">
      <div className="h-28 animate-pulse rounded-2xl border border-indigo-100 bg-white/70" />
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="h-44 animate-pulse rounded-2xl border border-indigo-100 bg-white/70" />
          <div className="h-56 animate-pulse rounded-2xl border border-indigo-100 bg-white/70" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-indigo-100 bg-white/70 lg:col-span-2" />
      </div>
    </div>
  );
}

export default function DomReadyGate({ children }: DomReadyGateProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (document.readyState === "interactive" || document.readyState === "complete") {
      setIsReady(true);
      return;
    }

    const handleReady = () => setIsReady(true);
    window.addEventListener("DOMContentLoaded", handleReady, { once: true });
    return () => window.removeEventListener("DOMContentLoaded", handleReady);
  }, []);

  if (!isReady) {
    return <AppLoadingFallback />;
  }

  return <>{children}</>;
}
