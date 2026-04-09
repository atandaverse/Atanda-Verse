import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getRouteConfig(routeTo: string) {
  const route = String(routeTo || "hello").trim().toLowerCase();
  if (route === "sessions") {
    return {
      sender: "Atanda Verse Sessions <sessions@atanda.site>",
      recipient: "sessions@atanda.site",
      replyTo: "sessions@atanda.site",
      label: "Atanda Verse Sessions",
    };
  }
  if (route === "support") {
    return {
      sender: "Atanda Support <support@atanda.site>",
      recipient: "support@atanda.site",
      replyTo: "support@atanda.site",
      label: "Atanda Support",
    };
  }
  return {
    sender: "Atanda <hello@atanda.site>",
    recipient: "hello@atanda.site",
    replyTo: "hello@atanda.site",
    label: "Atanda",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();
    if (!requestId) throw new Error("requestId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is missing");

    const { data: row, error } = await supabase
      .from("contact_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error || !row) throw new Error("Contact request not found");

    const route = getRouteConfig(row.route_to);
    const userName = row.name || "there";
    const issueLine = row.issue_type ? `<p style="margin:0 0 10px"><strong>Issue type:</strong> ${row.issue_type}</p>` : "";
    const packageLine = row.package ? `<p style="margin:0 0 10px"><strong>Package:</strong> ${row.package}</p>` : "";
    const pageLine = row.page_url ? `<p style="margin:0 0 10px"><strong>Page:</strong> ${row.page_url}</p>` : "";

    const ackPayload = {
      from: route.sender,
      reply_to: route.replyTo,
      to: [row.email],
      subject: `We received your request | ${route.label}`,
      html: `
        <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
            <div style="padding:22px 28px 18px;background:#0f172a;color:#fff">
              <div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">${route.label}</div>
              <div style="font-size:24px;font-weight:800;line-height:1.2;margin-top:10px">Your request is in.</div>
            </div>
            <div style="padding:28px;color:#172033">
              <p style="margin:0 0 14px;line-height:1.75">Hi ${userName},</p>
              <p style="margin:0 0 14px;line-height:1.75">We received your message and routed it to the right Atanda inbox. A member of the team will follow up with you soon.</p>
              <div style="padding:18px;border-radius:16px;background:#f8fafc;border:1px solid rgba(15,23,42,.06)">
                <p style="margin:0 0 10px"><strong>Subject:</strong> ${row.subject || "No subject provided"}</p>
                ${issueLine}
                ${packageLine}
                ${pageLine}
              </div>
              <p style="margin:18px 0 0;line-height:1.75;color:#5b6780">If you need to add more context, just reply to this email.</p>
            </div>
          </div>
        </div>
      `,
    };

    const notifyPayload = {
      from: route.sender,
      reply_to: route.replyTo,
      to: [route.recipient],
      subject: `[New ${row.category || "contact"}] ${row.subject || row.name || "Contact request"}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7">
          <h2 style="margin:0 0 16px">New contact request</h2>
          <p><strong>Name:</strong> ${row.name || ""}</p>
          <p><strong>Email:</strong> ${row.email || ""}</p>
          <p><strong>Category:</strong> ${row.category || ""}</p>
          <p><strong>Route:</strong> ${row.route_to || ""}</p>
          ${issueLine}
          ${packageLine}
          ${pageLine}
          <p><strong>Message:</strong></p>
          <div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid rgba(15,23,42,.06)">${String(row.message || "").replace(/\n/g, "<br>")}</div>
        </div>
      `,
    };

    const ackRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ackPayload),
    });

    const notifyRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notifyPayload),
    });

    const status = ackRes.ok && notifyRes.ok ? "acknowledged" : "pending-review";
    await supabase
      .from("contact_requests")
      .update({
        status,
        acknowledged_at: ackRes.ok ? new Date().toISOString() : null,
      })
      .eq("id", requestId);

    return new Response(JSON.stringify({ ok: true, status }), {
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
