import { statusLabel } from "@/lib/library/constants";

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    in_progress: "bg-midnight text-white",
    finished: "bg-[#dff7c4] text-[#2b4a00]",
    paused: "bg-[#fff1c9] text-[#5c4000]",
    planned: "bg-[#e7e8fb] text-[#26305a]",
    abandoned: "bg-[#eee] text-[#555]",
  };
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${tone[status] ?? ""}`}>{statusLabel(status)}</span>;
}
