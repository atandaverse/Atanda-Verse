import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function siteUrl(path = "") {
  return `https://verse.atanda.site/${String(path).replace(/^\/+/, "")}`;
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeApplicationNo() {
  return `AV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function makeUsername(name: string, email: string, appNo: string) {
  const seed = (name || email.split("@")[0] || "reader").toLowerCase();
  const base = seed.replace(/[^a-z0-9]+/g, "").slice(0, 14) || "reader";
  return `${base}-${appNo.slice(-4).toLowerCase()}`;
}

async function sha256Text(text: string) {
  const data = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(resendKey: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, name = "", source = "newsletter", tags = "" } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Valid email is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is missing");

    const resourceId = "5-day-clarity-challenge";
    const resourceTitle = "5-Day Clarity Challenge";
    const { data: existing } = await supabase
      .from("vault_access_requests")
      .select("*")
      .eq("email", cleanEmail)
      .in("requested_resource_id", [resourceId, "lib-1"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const appNo = existing?.application_no || makeApplicationNo();
    const username = existing?.vault_username || makeUsername(cleanName, cleanEmail, appNo);
    const accessHash = existing?.access_code_hash || await sha256Text(appNo);
    const requestId = existing?.id || `var-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

    await supabase.from("vault_access_requests").upsert({
      id: requestId,
      application_no: appNo,
      full_name: cleanName || cleanEmail.split("@")[0],
      email: cleanEmail,
      reason: "Automatic access from newsletter subscription.",
      requested_resource_id: resourceId,
      requested_resource_title: resourceTitle,
      status: "approved",
      vault_username: username,
      access_code_hash: accessHash,
      source_page: String(source || "newsletter"),
      page_url: siteUrl("library.html"),
      decided_at: existing?.decided_at || new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString(),
    });

    if (!existing?.emailed_at) {
      const vaultUrl = siteUrl("vaultlibrary.html");
      await sendEmail(resendKey, {
        from: "Atanda Verse Blog <letters@atanda.site>",
        reply_to: "letters@atanda.site",
        to: [cleanEmail],
        subject: "Your 5-Day Clarity Challenge access",
        html: `
          <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
              <div style="padding:22px 28px;background:#0f172a;color:#fff">
                <div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">Atanda Verse</div>
                <h1 style="font-size:24px;margin:10px 0 0">Your clarity guide is ready</h1>
              </div>
              <div style="padding:28px;line-height:1.75">
                <p>Hi ${escapeHtml(cleanName || "there")},</p>
                <p>Thank you for joining Atanda Verse. Your free <strong>5-Day Clarity Challenge</strong> access has been created.</p>
                <div style="padding:16px;border-radius:14px;background:#f8fafc;border:1px solid rgba(15,23,42,.08)">
                  <p><strong>Vault page:</strong> <a href="${vaultUrl}">${vaultUrl}</a></p>
                  <p><strong>Vault username:</strong> ${escapeHtml(username)}</p>
                  <p><strong>Application number:</strong> ${escapeHtml(appNo)}</p>
                </div>
                <p>Use the username and application number above to enter the vault and begin reading the guide.</p>
                <p style="font-size:13px;color:#64748b">Source: ${escapeHtml(source)} ${tags ? `| Tags: ${escapeHtml(tags)}` : ""}</p>
              </div>
            </div>
          </div>
        `,
      });

      await supabase
        .from("vault_access_requests")
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", requestId);
    }

    return new Response(JSON.stringify({ ok: true, requestId, application_no: appNo, vault_username: username }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error.message || error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
