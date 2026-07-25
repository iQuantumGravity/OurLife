import { redirect } from "next/navigation";

// See the note in ../console/page.tsx — merged into /records.
export default function UploadsRedirect() {
  redirect("/records?tab=statements");
}
