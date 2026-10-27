import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">{title}</h1>
        {description ? <div className="mt-1 text-[15px] text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-panel border border-line bg-surface ${className}`}>
      {children}
    </section>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-surface-muted text-secondary",
  success: "bg-success-bg text-success",
  warning: "bg-amber-bg text-amber",
  danger: "bg-brick-bg text-brick",
  info: "bg-moss text-forest",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES | string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        TONES[tone] ?? TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss text-forest">
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | number | undefined | null>;
}) {
  if (totalPages <= 1) return null;

  function href(target: number): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages: number[] = [];
  for (let value = windowStart; value <= windowEnd; value += 1) pages.push(value);

  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-[12px] text-muted">
        Halaman <span className="font-semibold text-ink">{page}</span> dari {totalPages}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            className="flex h-8 items-center gap-1 rounded border border-line bg-white px-2.5 text-[12px] font-semibold text-ink hover:bg-paper"
            href={href(page - 1)}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Sebelumnya
          </Link>
        ) : null}
        {pages.map((value) => (
          <Link
            aria-current={value === page ? "page" : undefined}
            className={`flex h-8 min-w-8 items-center justify-center rounded px-2 text-[12px] font-semibold ${
              value === page
                ? "bg-forest text-white"
                : "border border-line bg-white text-ink hover:bg-paper"
            }`}
            href={href(value)}
            key={value}
          >
            {value}
          </Link>
        ))}
        {page < totalPages ? (
          <Link
            className="flex h-8 items-center gap-1 rounded border border-line bg-white px-2.5 text-[12px] font-semibold text-ink hover:bg-paper"
            href={href(page + 1)}
          >
            Berikutnya
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function SummaryTile({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-panel border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-moss text-forest">
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[22px] font-semibold leading-7 text-ink">{value}</p>
      {caption ? <p className="mt-0.5 text-[12px] text-muted">{caption}</p> : null}
    </div>
  );
}
