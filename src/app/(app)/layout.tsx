import { Nav } from "@/components/Nav";
import { getContext } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getContext();
  return (
    <div className="min-h-screen">
      <Nav
        householdName={ctx ? "Our household" : "Not connected"}
        email={ctx?.email}
      />
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
