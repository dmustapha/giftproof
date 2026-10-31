// File: src/app/app/loading.tsx
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="h-8 w-40 animate-pulse rounded-[8px] bg-[var(--ink-08)]" />
      <div className="mx-auto h-32 w-full max-w-2xl animate-pulse rounded-[9px] bg-[var(--ink-04)]" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-[11px] border border-[var(--hair)] bg-[var(--ink-04)]" />
        ))}
      </div>
    </main>
  );
}
