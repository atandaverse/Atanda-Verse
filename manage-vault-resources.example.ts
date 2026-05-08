import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const allowedFields = [
  "id",
  "title",
  "module",
  "format",
  "summary",
  "access_level",
  "file_url",
  "cover_url",
  "duration",
  "sort_order",
  "status",
  "tags",
  "notes",
  "updated_at",
];

function assertAdmin(req: Request) {
  const expected = Deno.env.get("ADMIN_API_TOKEN") || "";
  const actual = req.headers.get("x-admin-token") || "";
  if (!expected || actual !== expected) throw new Error("Admin authorization failed");
}

function cleanResource(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in input) out[key] = input[key];
  }
  out.id = String(out.id || `vr-${Date.now()}`);
  out.title = String(out.title || "").trim();
  if (!out.title) throw new Error("title is required");
  out.status = String(out.status || "published");
  out.access_level = String(out.access_level || "approved");
  out.sort_order = Number.isFinite(Number(out.sort_order)) ? Number(out.sort_order) : 0;
  out.updated_at = new Date().toISOString();
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    assertAdmin(req);
    const { action, resource, id } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    if (action === "list") {
      const { data, error } = await supabase
        .from("vault_resources")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, resources: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
      });
    }

    if (action === "upsert") {
      const row = cleanResource(resource || {});
      const { data, error } = await supabase
        .from("vault_resources")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, resource: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const resourceId = String(id || "").trim();
      if (!resourceId) throw new Error("id is required");
      const { error } = await supabase.from("vault_resources").delete().eq("id", resourceId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported action");
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }
});
