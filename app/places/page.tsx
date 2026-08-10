export default function PlacesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Places</h1>
      <section className="rounded-lg border p-4">
        <p className="text-sm opacity-80">
          Place-level digest endpoint:{" "}
          <code className="rounded bg-black/5 px-1 py-0.5">
            /api/places/digest?city=Hangzhou
          </code>
        </p>
        <p className="mt-2 text-sm opacity-80">
          Aggregated city count endpoint:{" "}
          <code className="rounded bg-black/5 px-1 py-0.5">/api/places/city-counts</code>
        </p>
      </section>
    </main>
  );
}
