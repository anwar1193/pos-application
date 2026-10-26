export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] animate-pulse motion-reduce:animate-none">
      <div className="mb-6 h-8 w-48 rounded bg-surface-muted" />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-28 rounded-panel border border-line bg-surface"
            key={index}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-80 rounded-panel border border-line bg-surface xl:col-span-2" />
        <div className="h-80 rounded-panel border border-line bg-surface" />
      </div>
    </div>
  );
}
