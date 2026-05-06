import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAULT_BUCKET = "atanda-vault-private";

function cleanPrivatePath(value: string) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("vault-private:")) return "";
  return raw.replace(/^vault-private:/, "").replace(/^\/+/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { requestId, applicationNo, resourceId } = await req.json();
    if (!requestId || !resourceId) throw new Error("requestId and resourceId are required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: access, error: accessError } = await supabase
      .from("vault_access_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (accessError || !access) throw new Error("Vault access not found");
    if (access.status !== "approved") throw new Error("Vault access is not approved");
    if (String(access.application_no || "").toUpperCase() !== String(applicationNo || "").toUpperCase()) {
      throw new Error("Vault session could not be validated");
    }

    const { data: resource, error: resourceError } = await supabase
      .from("vault_resources")
      .select("*")
      .eq("id", resourceId)
      .eq("status", "published")
      .single();

    if (resourceError || !resource) throw new Error("Vault resource not found");
    const path = cleanPrivatePath(resource.file_url);
    if (!path) throw new Error("Vault resource is not stored privately");

    const { data: file, error: fileError } = await supabase.storage
      .from(VAULT_BUCKET)
      .download(path);

    if (fileError || !file) throw new Error(fileError?.message || "Could not load vault file");

    await supabase.from("vault_activity_logs").insert({
      request_id: requestId,
      application_no: access.application_no || "",
      vault_username: access.vault_username || "",
      event_type: "serve",
      resource_id: resource.id,
      resource_title: resource.title || "",
      page_url: req.headers.get("referer") || "",
      user_agent: req.headers.get("user-agent") || "",
    });

    const contentType = file.type || "application/octet-stream";
    const safeName = String(resource.title || "vault-material").replace(/[^\w.-]+/g, "-").replace(/-+$/g, "");

    return new Response(file, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeName || "vault-material"}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }
});
