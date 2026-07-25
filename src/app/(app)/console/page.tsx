import { redirect } from "next/navigation";

// Pay stubs and statements were merged into a single /records route with a
// toggle. Kept so old links, bookmarks and the assistant's saved replies land
// in the right place.
export default function ConsoleRedirect() {
  redirect("/records?tab=stubs");
}
