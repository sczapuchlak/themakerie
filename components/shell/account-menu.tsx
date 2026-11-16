import { signOut } from "@/app/auth/actions";
import { getAccess } from "@/lib/auth/dal";

/**
 * Signed-in owner + sign out. Reads the session, so render it inside
 * <Suspense>. Shows initials rather than loading a remote avatar.
 */
export async function AccountMenu({ variant }: { variant: "sidebar" | "compact" }) {
  const access = await getAccess();
  if (access.status !== "authorized") return null;
  const { name, email } = access.owner;
  const label = name ?? email ?? "Owner";
  const initials = label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (variant === "compact") {
    return (
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 items-center gap-2 rounded-full pl-1 text-xs font-semibold text-body hover:text-strong"
        >
          <Initials value={initials} />
          Sign out
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-tile px-2 py-2 sidebar-collapsed:justify-center sidebar-collapsed:px-0">
      <Initials value={initials} />
      <div className="min-w-0 flex-1 sidebar-collapsed:hidden">
        <p className="truncate text-sm font-semibold text-strong">{label}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs font-medium text-muted underline-offset-4 hover:text-strong hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Initials({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-ultraviolet via-pink to-peach text-[0.7rem] font-bold text-midnight"
    >
      {value || "★"}
    </span>
  );
}
