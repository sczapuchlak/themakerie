"use client";

import { useEffect, useRef } from "react";

/**
 * Accessible modal built on <dialog>: focus trapping, Esc to close and a
 * backdrop come from the platform. Bottom sheet on phones, centered on
 * larger screens, with iPhone safe-area padding.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className="tone-paper m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-panel bg-paper p-0 text-body shadow-2xl backdrop:bg-midnight/50 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-panel"
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="font-display-tight text-[1.35rem]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-10 place-items-center rounded-full text-xl text-muted hover:bg-selected"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <div className="border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
