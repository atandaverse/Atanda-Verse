const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function splitEmails(value: string | null) {
  return String(value || "")
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function uniqueEmails(values: string[]) {
  return Array.from(new Set(values.map((email) => email.toLowerCase())));
}

function isRegistration(eventType: string, payload: Record<string, unknown>) {
  const source = String(payload?.source || "").toLowerCase();
  return /registration/i.test(eventType) || /register|session/.test(source);
}

function notifyRecipients(eventType: string, payload: Record<string, unknown>) {
  const configured = [
    ...splitEmails(Deno.env.get("ADMIN_NOTIFY_EMAIL")),
    ...splitEmails(Deno.env.get("ADMIN_NOTIFY_EMAILS")),
    ...splitEmails(Deno.env.get("ADMIN_COPY_EMAIL")),
    ...splitEmails(Deno.env.get("ADMIN_COPY_EMAILS")),
  ];
  const defaults = ["hello@atanda.site"];
  if (isRegistration(eventType, payload)) defaults.push("sessions@atanda.site");
  return uniqueEmails(configured.length ? [...configured, ...defaults] : defaults);
}

function titleForEvent(eventType: string) {
  const map: Record<string, string> = {
    "subscriber.created": "New newsletter subscriber",
    "registration.created": "New session registration",
    "testimonial.created": "New testimonial awaiting review",
    "comment.created": "New blog comment",
    "vault.access.requested": "New vault access request",
  };
  return map[eventType] || "New Atanda Verse admin event";
}

function workspaceAction(eventType: string, payload: Record<string, unknown>) {
  const base = Deno.env.get("ADMIN_WORKSPACE_URL") || "https://verse.atanda.site/workspace.html";
  const cleanBase = base.replace(/#.*$/, "");
  const panel = String(payload?.adminPanel || "").trim();
  if (panel) {
    return {
      href: `${cleanBase}#${encodeURIComponent(panel)}`,
      label: String(payload?.adminLabel || "Open Admin Workspace"),
    };
  }
  const isVault =
    /vault/i.test(eventType) ||
    Boolean(payload?.application_no) ||
    Boolean(payload?.vaultRequestId) ||
    Boolean(payload?.requestId);
  const isReg = isRegistration(eventType, payload);
  return {
    href: isVault ? `${cleanBase}#vault` : isReg ? `${cleanBase}#registrations` : cleanBase,
    label: isVault ? "Open Workspace Vault Access" : isReg ? "Open Registrations" : "Open Admin Workspace",
  };
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    name: "Full Name",
    fullName: "Full Name",
    email: "Email Address",
    phone: "WhatsApp / Phone",
    sessionType: "Preferred Session Type",
    sessionLabel: "Session Label",
    goals: "What They Hope To Achieve",
    source: "Source",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function rows(payload: Record<string, unknown>) {
  return Object.entries(payload || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => {
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(15,23,42,.08);color:#64748b;width:34%;font-weight:700">${escapeHtml(fieldLabel(key))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(15,23,42,.08);color:#172033">${escapeHtml(value).replaceAll("\n", "<br>")}</td>
      </tr>`;
    })
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { eventType = "admin.event", payload = {}, pageUrl = "", createdAt = "" } = await req.json();
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is missing");

    const payloadObj = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const title = titleForEvent(String(eventType));
    const bodyRows = rows(payloadObj);
    const action = workspaceAction(String(eventType), payloadObj);
    const from = Deno.env.get("ADMIN_NOTIFY_FROM") || "Atanda Verse Admin <hello@atanda.site>";
    const to = notifyRecipients(String(eventType), payloadObj);
    const replyTo = String(payloadObj.email || "").trim() || Deno.env.get("ADMIN_NOTIFY_REPLY_TO") || "support@atanda.site";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to,
        subject: `[Admin] ${title}`,
        html: `
          <div style="margin:0;padding:24px 12px;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,.08)">
              <div style="padding:22px 28px 18px;background:#0f172a;color:#fff">
                <div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#f8b4bc">Atanda Verse Admin</div>
                <div style="font-size:24px;font-weight:800;line-height:1.2;margin-top:10px">${escapeHtml(title)}</div>
              </div>
              <div style="padding:24px 28px;color:#172033">
                <p style="margin:0 0 16px;line-height:1.75">A new item has appeared in the admin/workspace flow. A copy of the submitted details is below.</p>
                <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid rgba(15,23,42,.08);border-radius:14px;overflow:hidden">
                  <tbody>
                    ${bodyRows || `<tr><td style="padding:14px;color:#64748b">No extra details were provided.</td></tr>`}
                    ${pageUrl ? `<tr><td style="padding:10px 12px;color:#64748b;font-weight:700">Page</td><td style="padding:10px 12px"><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></td></tr>` : ""}
                    ${createdAt ? `<tr><td style="padding:10px 12px;color:#64748b;font-weight:700">Time</td><td style="padding:10px 12px">${escapeHtml(createdAt)}</td></tr>` : ""}
                  </tbody>
                </table>
                <p style="margin:20px 0 0">
                  <a href="${escapeHtml(action.href)}" style="display:inline-block;background:#c7374a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:800">${escapeHtml(action.label)}</a>
                </p>
                <p style="margin:14px 0 0;line-height:1.75;color:#64748b">Replying to this email should address the submitted email when available.</p>
              </div>
            </div>
          </div>
        `,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(JSON.stringify(json));

    return new Response(JSON.stringify({ ok: true, id: json?.id || "", recipients: to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
