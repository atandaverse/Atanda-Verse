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
    const { requestId, action = "requested" } = await req.json();
    if (!requestId) throw new Error("requestId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is missing");

    const { data: row, error } = await supabase
      .from("vault_access_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error || !row) throw new Error("Vault request not found");

    const name = escapeHtml(row.full_name || "there");
    const appNo = escapeHtml(row.application_no || "");
    const vaultUrl = siteUrl("vaultlibrary");
    const from = "Atanda Support <support@atanda.site>";

    if (action === "requested") {
      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: ["hello@atanda.site"],
        subject: `[Vault request] ${row.full_name || row.email || row.application_no}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7">
            <h2>New vault access request</h2>
            <p><strong>Application:</strong> ${appNo}</p>
            <p><strong>Name:</strong> ${escapeHtml(row.full_name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(row.email)}</p>
            <p><strong>Requested resource:</strong> ${escapeHtml(row.requested_resource_title || "Vault Library")}</p>
            <p><strong>Reason:</strong></p>
            <div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid rgba(15,23,42,.08)">${escapeHtml(row.reason).replaceAll("\n", "<br>")}</div>
          </div>
        `,
      });

      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: [row.email],
        subject: `Vault request received | ${row.application_no}`,
        html: `
          <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
              <div style="padding:22px 28px;background:#0f172a;color:#fff"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">Atanda Verse Vault</div><h1 style="font-size:24px;margin:10px 0 0">Your request is under review</h1></div>
              <div style="padding:28px">
                <p>Hi ${name},</p>
                <p>We received your request for the Atanda Verse Vault Library.</p>
                <p><strong>Application number:</strong> ${appNo}</p>
                <p>If approved, we will email your vault username and access instructions.</p>
              </div>
            </div>
          </div>
        `,
      });
    }

    if (action === "approved") {
      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: [row.email],
        subject: `Your Atanda Verse Vault access is approved | ${row.application_no}`,
        html: `
          <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
              <div style="padding:22px 28px;background:#0f172a;color:#fff"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">Atanda Verse Vault</div><h1 style="font-size:24px;margin:10px 0 0">Vault access approved</h1></div>
              <div style="padding:28px">
                <p>Hi ${name},</p>
                <p>Your vault access has been approved.</p>
                <div style="padding:16px;border-radius:14px;background:#f8fafc;border:1px solid rgba(15,23,42,.08)">
                  <p><strong>Vault page:</strong> <a href="${vaultUrl}">${vaultUrl}</a></p>
                  <p><strong>Vault username:</strong> ${escapeHtml(row.vault_username)}</p>
                  <p><strong>Application number:</strong> ${appNo}</p>
                </div>
                <p>Use the vault username and application number to enter the vault library.</p>
              </div>
            </div>
          </div>
        `,
      });
    }

    if (action === "terms") {
      if (row.terms_emailed_at) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: [row.email],
        subject: `Vault library terms | ${row.application_no}`,
        html: `
          <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:660px;margin:0 auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
              <div style="padding:22px 28px;background:#0f172a;color:#fff">
                <div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">Atanda Verse Vault</div>
                <h1 style="font-size:24px;margin:10px 0 0">Vault terms and copyright notice</h1>
              </div>
              <div style="padding:28px;line-height:1.75">
                <p>Hi ${name},</p>
                <p>You have successfully logged into the Atanda Verse Vault Library.</p>
                <p>Your vault access is personal to you. Materials in the vault are protected Atanda Verse resources and may not be copied, resold, reposted, uploaded elsewhere, forwarded, or distributed in group chats/classes without written permission.</p>
                <div style="padding:16px;border-radius:14px;background:#f8fafc;border:1px solid rgba(15,23,42,.08)">
                  <p><strong>Application number:</strong> ${appNo}</p>
                  <p><strong>Vault username:</strong> ${escapeHtml(row.vault_username)}</p>
                  <p><strong>Vault page:</strong> <a href="${vaultUrl}">${vaultUrl}</a></p>
                </div>
                <p>Viewing or saving a file does not transfer ownership, copyright, or reuse rights. Activity in the vault may be logged to protect the library and improve the reader experience.</p>
                <p>If you need permission to use a material in a class, group, or public setting, reply to this email first.</p>
              </div>
            </div>
          </div>
        `,
      });

      await supabase
        .from("vault_access_requests")
        .update({ terms_emailed_at: new Date().toISOString() })
        .eq("id", requestId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "warning") {
      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: [row.email],
        subject: `Important vault library notice | ${row.application_no}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7">
            <h2>Atanda Verse Vault notice</h2>
            <p>Hi ${name},</p>
            <p>This is a reminder that Atanda Verse vault materials are for your personal use only.</p>
            <div style="padding:16px;border-radius:14px;background:#fff7ed;border:1px solid rgba(194,65,12,.18)">
              ${escapeHtml(row.warning_note || "Please do not share, forward, repost, resell, upload, or distribute vault materials.").replaceAll("\n", "<br>")}
            </div>
            <p>Continued misuse may lead to restricted access.</p>
          </div>
        `,
      });
    }

    if (action === "restricted") {
      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: [row.email],
        subject: `Vault access restricted | ${row.application_no}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7">
            <h2>Your vault access has been restricted</h2>
            <p>Hi ${name},</p>
            <p>Your Atanda Verse Vault Library access has been restricted. This usually happens when material-sharing, copyright, or access terms need review.</p>
            ${row.admin_note ? `<div style="padding:16px;border-radius:14px;background:#f8fafc;border:1px solid rgba(15,23,42,.08)">${escapeHtml(row.admin_note).replaceAll("\n", "<br>")}</div>` : ""}
            <p>If you believe this was a mistake, reply to this email and include your application number: <strong>${appNo}</strong>.</p>
          </div>
        `,
      });
    }

    if (action === "rejected") {
      await sendEmail(resendKey, {
        from,
        reply_to: "support@atanda.site",
        to: [row.email],
        subject: `Vault request update | ${row.application_no}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7">
            <p>Hi ${name},</p>
            <p>Thank you for requesting access to the Atanda Verse Vault Library. We are not approving this request right now.</p>
            ${row.admin_note ? `<p><strong>Note:</strong> ${escapeHtml(row.admin_note)}</p>` : ""}
            <p>You can still use the public library here: <a href="${siteUrl("library")}">${siteUrl("library")}</a></p>
          </div>
        `,
      });
    }

    await supabase
      .from("vault_access_requests")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", requestId);

    return new Response(JSON.stringify({ ok: true }), {
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
