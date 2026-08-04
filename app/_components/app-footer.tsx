import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="mt-6 border-t border-indigo-100 bg-transparent">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:gap-6 lg:px-8">
        <div className="md:basis-3/5" />

        <div className="flex items-center justify-start gap-2 md:basis-2/5 md:justify-end">
          <Link
            href="/"
            aria-label="Home"
            className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.5 10.5V20h11V10.5"
              />
            </svg>
          </Link>
          <Link
            href="/admin/ai-options"
            aria-label="Setting"
            className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.98 3.5a1.7 1.7 0 0 1 1.67 1.33l.18.78a1.7 1.7 0 0 0 2.02 1.27l.78-.18a1.7 1.7 0 0 1 1.91.87l.93 1.61a1.7 1.7 0 0 1-.26 2.08l-.6.53a1.7 1.7 0 0 0 0 2.54l.6.53a1.7 1.7 0 0 1 .26 2.08l-.93 1.61a1.7 1.7 0 0 1-1.91.87l-.78-.18a1.7 1.7 0 0 0-2.02 1.27l-.18.78a1.7 1.7 0 0 1-1.67 1.33h-1.86a1.7 1.7 0 0 1-1.67-1.33l-.18-.78a1.7 1.7 0 0 0-2.02-1.27l-.78.18a1.7 1.7 0 0 1-1.91-.87l-.93-1.61a1.7 1.7 0 0 1 .26-2.08l.6-.53a1.7 1.7 0 0 0 0-2.54l-.6-.53a1.7 1.7 0 0 1-.26-2.08l.93-1.61a1.7 1.7 0 0 1 1.91-.87l.78.18a1.7 1.7 0 0 0 2.02-1.27l.18-.78A1.7 1.7 0 0 1 10.12 3.5h1.86Z"
              />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  );
}
