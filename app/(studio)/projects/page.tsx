import { redirect } from "next/navigation";

/** Projects live inside the Pattern Library; individual projects stay at /projects/<id>. */
export default function ProjectsIndex() {
  redirect("/patterns");
}
