import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function publicResource(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    format: row.format,
    summary: row.summary,
    access_level: row.access_level,
    cover_url: row.cover_url,
    duration: row.duration,
    sort_order: row.sort_order,
    status: row.status,
    tags: row.tags,
    notes: row.notes,
    // Only reveal whether a file exists. The private path stays server-side.
    has_file: !!row.file_url,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { requestId, applicationNo } = await req.json();
    if (!requestId || !applicationNo) throw new Error("requestId and applicationNo are required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: access, error: accessError } = await supabase
      .from("vault_access_requests")
      .select("id,application_no,vault_username,status")
      .eq("id", requestId)
      .single();

    if (accessError || !access) throw new Error("Vault access not found");
    if (access.status !== "approved") throw new Error("Vault access is not approved");
    if (String(access.application_no || "").toUpperCase() !== String(applicationNo || "").toUpperCase()) {
      throw new Error("Vault session could not be validated");
    }

    const { data: rows, error: resourceError } = await supabase
      .from("vault_resources")
      .select("id,title,module,format,summary,access_level,cover_url,duration,sort_order,status,tags,notes,file_url,updated_at")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });

    if (resourceError) throw resourceError;

    await supabase.from("vault_activity_logs").insert({
      request_id: requestId,
      application_no: access.application_no || "",
      vault_username: access.vault_username || "",
      event_type: "list",
      resource_id: "",
      resource_title: "",
      page_url: req.headers.get("referer") || "",
      user_agent: req.headers.get("user-agent") || "",
    });

    return new Response(JSON.stringify({ ok: true, resources: (rows || []).map(publicResource) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }
});
