import Link from "next/link";
import { Starburst } from "@/components/motifs/starburst";

type WordmarkProps = {
  /** In the desktop sidebar: collapses to an "M" monogram with the sidebar. */
  collapsible?: boolean;
};

export function Wordmark({ collapsible = false }: WordmarkProps) {
  const hideWhenCollapsed = collapsible ? "sidebar-collapsed:hidden" : "";
  return (
    <Link
      href="/"
      className="group inline-flex min-h-11 items-center gap-1.5 rounded-full text-strong"
    >
      <span className="sr-only">The Makerie — home</span>
      <span aria-hidden="true" className={`font-serif text-xl leading-none italic ${hideWhenCollapsed}`}>
        The
      </span>
      <span
        aria-hidden="true"
        className="font-display-tight text-[1.6rem] leading-none tracking-[-0.03em]"
      >
        M<span className={hideWhenCollapsed}>akerie</span>
      </span>
      <Starburst className="size-3 -translate-y-2.5 text-spark transition-transform duration-500 ease-soft group-hover:rotate-90" />
    </Link>
  );
}
