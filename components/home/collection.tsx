import Link from "next/link";

/**
 * Home collection — Active projects / Recent patterns. One calm, luminous
 * panel holds the heading and content together (level 3 of the hierarchy).
 * Today it shows a concise, honest empty state; the dashed slot mirrors the
 * image-led card that real items will use: projects as portrait photos
 * (arch crop), patterns as document covers (page with folded corner).
 */
type CollectionProps = {
  id: string;
  number: string;
  title: string;
  href: "/patterns" | `/patterns/${string}`;
  viewAllLabel: string;
  emptyTitle: string;
  message: string;
  actionLabel: string;
  variant: "projects" | "patterns";
};

export function Collection({
  id,
  number,
  title,
  href,
  viewAllLabel,
  emptyTitle,
  message,
  actionLabel,
  variant,
}: CollectionProps) {
  const projects = variant === "projects";
  return (
    <section
      aria-labelledby={id}
      className={`surface-panel relative h-full overflow-hidden p-5 sm:p-6 ${
        projects ? "rounded-card rounded-tl-md" : "rounded-card rounded-br-md"
      }`}
    >
      <div className="relative flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-end gap-2.5 sm:gap-3">
          <span aria-hidden="true" className="numeral-outline text-[2.1rem] text-strong sm:text-[2.6rem]">
            {number}
          </span>
          <h2 id={id} className="font-display-tight text-[1.35rem] sm:text-[1.6rem]">
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-line-strong bg-white px-3 text-sm font-semibold whitespace-nowrap text-strong transition-colors hover:border-strong sm:px-3.5"
        >
          {viewAllLabel}
          <span aria-hidden="true" className="ml-1.5">
            →
          </span>
        </Link>
      </div>

      <div className="relative mt-5 flex items-center gap-5 border-t border-line pt-5">
        <Slot kind={variant} />
        <div className="min-w-0">
          <p className="font-semibold text-strong">{emptyTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
          <Link
            href={href}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          >
            {actionLabel}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

    </section>
  );
}

/** Running-stitch outline in the shape of the future card's image. */
function Slot({ kind }: { kind: "projects" | "patterns" }) {
  return (
    <svg
      viewBox="0 0 80 100"
      className="h-20 w-16 shrink-0 text-accent sm:h-24 sm:w-20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="5 5"
      aria-hidden="true"
    >
      {kind === "projects" ? (
        <path d="M2 98V40a38 38 0 0 1 76 0v58Z" />
      ) : (
        <path d="M2 2h56l20 20v76H2ZM58 2v20h20" />
      )}
      <path d="M40 52v16M32 60h16" strokeDasharray="none" />
    </svg>
  );
}
