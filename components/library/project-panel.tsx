"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { deleteProject } from "@/lib/library/actions";
import type { ProjectDetail } from "@/lib/library/data";

type P = ProjectDetail["project"];

/* -------------------------------------------------------------------- delete */

export function DeleteProject({ project }: { project: P }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#a3123f]" onClick={() => setOpen(true)}>
        Delete project…
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delete project?"
        footer={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteProject(project.id);
                  if (!r.ok) return setError(r.error);
                  router.push(r.patternId ? `/patterns/${r.patternId}` : "/patterns");
                })
              }
            >
              Delete permanently
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Keep it
            </button>
          </div>
        }
      >
        <p className="text-body">
          <strong className="text-strong">{project.name}</strong> — its notes, sessions and photos — will be deleted. The pattern stays.
        </p>
        {error && <p className="mt-3 text-sm font-semibold text-[#a3123f]">{error}</p>}
      </Sheet>
    </>
  );
}
