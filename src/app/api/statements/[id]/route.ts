import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

// Returns a short-lived signed URL and redirects to it. RLS on `documents`
// means the lookup only succeeds if the signed-in user is in the household.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "backend not configured" }, { status: 503 });
  }
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("statements")
    .createSignedUrl(doc.storage_path, 60);

  if (error || !data) {
    return NextResponse.json({ error: "could not sign url" }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
