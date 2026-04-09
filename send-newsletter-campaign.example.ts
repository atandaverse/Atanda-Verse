// Supabase Edge Function starter for manual newsletter sending.
// Suggested filename inside Supabase functions:
// supabase/functions/send-newsletter-campaign/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function absUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `https://verse.atanda.site/${String(path).replace(/^\/+/, "")}`;
}

function emailSafeImage(path: string) {
  const url = absUrl(path || "").trim();
  if (!url) return "";
  if (/^(data:|blob:|file:)/i.test(url)) return "";
  try {
    const parsed = new URL(url);
    if (/^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) return "";
  } catch (_e) {
    return "";
  }
  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url)) return url;
  if (/\/storage\/v1\/object\//i.test(url)) return url;
  if (/\/images\//i.test(url)) return url;
  return "";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaignId, overrides = {} } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is missing");

    const { data: campaign, error: campaignError } = await supabase
      .from("newsletter_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) throw new Error("Campaign not found");

    const { data: subscribers, error: subscribersError } = await supabase
      .from("subscribers")
      .select("email,name")
      .order("subscribed_at", { ascending: false });

    if (subscribersError) throw subscribersError;

    const { data: post } = campaign.post_id
      ? await supabase.from("posts").select("*").eq("id", campaign.post_id).single()
      : { data: null };

    await supabase.from("newsletter_campaigns").update({ status: "sending" }).eq("id", campaignId);

    let sent = 0;
    const browserUrl = campaign.post_id
      ? `https://verse.atanda.site/post.html?id=${campaign.post_id}`
      : "https://verse.atanda.site/blog.html";
    const title = post?.title || campaign.subject;
    const preview = overrides.preview_text || campaign.preview_text || post?.excerpt || "";
    const image = emailSafeImage(post?.image || "");
    const bodyCopy = overrides.body_copy || post?.excerpt || preview || "";
    const kicker = overrides.hero_kicker || "New on Atanda Verse";
    const ctaLabel = overrides.cta_label || "Read now";
    const browserLabel = overrides.browser_link_label || "Open in browser";
    const senderAddress = String(campaign.sender_email || "").trim();
    const brandedSender = senderAddress.includes("<")
      ? senderAddress
      : `Atanda Verse Blog <${senderAddress || "letters@atanda.site"}>`;

    for (const sub of subscribers || []) {
      const payload = {
        from: brandedSender,
        reply_to: campaign.reply_to || "letters@atanda.site",
        to: [sub.email],
        subject: campaign.subject,
        html: `
          <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
              <div style="padding:22px 28px 18px;background:#0f172a;color:#fff">
                <div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">Atanda Verse</div>
                <div style="font-size:15px;line-height:1.75;color:rgba(255,255,255,.78);margin-top:12px;max-width:520px">${preview || "A new reflection is ready to read."}</div>
              </div>
              ${image ? `<div style="background:#ffffff;padding:24px 24px 0"><img src="${image}" alt="${title}" style="display:block;width:100%;height:auto;max-height:280px;object-fit:cover;border-radius:18px"></div>` : ""}
              <div style="padding:28px;background:#ffffff;color:#172033">
                <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#c7374a;font-weight:700;margin-bottom:12px">${kicker}</div>
                <div style="font-size:28px;font-weight:800;line-height:1.18;margin-bottom:14px">${title}</div>
                <div style="font-size:16px;line-height:1.8;color:#52607a">${bodyCopy}</div>
                <div style="margin-top:26px">
                  <a href="${browserUrl}" style="display:inline-block;background:#c7374a;color:#fff;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:700">${ctaLabel}</a>
                </div>
                <div style="margin-top:18px"><a href="${browserUrl}" style="color:#c7374a;text-decoration:none;font-size:14px;font-weight:600">${browserLabel}</a></div>
              </div>
              <div style="padding:18px 28px 24px;background:#f8fafc;border-top:1px solid rgba(15,23,42,.06);font-size:13px;line-height:1.7;color:#6b7280">
                You received this because you subscribed to Atanda Verse updates.
              </div>
            </div>
          </div>
        `,
      };

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resendJson = await resendResponse.json().catch(() => ({}));

      await supabase.from("newsletter_deliveries").upsert({
        id: `${campaignId}-${sub.email}`,
        campaign_id: campaignId,
        subscriber_email: sub.email,
        delivery_status: resendResponse.ok ? "sent" : "failed",
        provider_message_id: resendJson?.id || "",
        error_message: resendResponse.ok ? "" : JSON.stringify(resendJson),
        sent_at: resendResponse.ok ? new Date().toISOString() : null,
      });

      if (resendResponse.ok) sent += 1;
    }

    await supabase
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);

    return new Response(JSON.stringify({ ok: true, sent }), {
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
