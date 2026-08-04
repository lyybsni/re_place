export default function GlobalLoading() {
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
