import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hashString(value: string) {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return "h" + Math.abs(hash).toString(36);
}

function getBucket(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  return `${y}${m}${d}${h}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const postId = String(body?.postId || "").trim();
    if (!postId) throw new Error("postId is required");

    const visitorKey = String(body?.visitorKey || "").trim() || hashString([
      body?.userAgent || "",
      body?.language || "",
      body?.timezone || "",
      body?.screen?.width || 0,
      body?.screen?.height || 0
    ].join("|"));

    const sessionId = String(body?.sessionId || "").trim();
    const bucket = getBucket();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const eventId = `pve-${postId}-${visitorKey}-${bucket}`;

    const eventRow = {
      id: eventId,
      post_id: postId,
      visitor_key: visitorKey,
      session_id: sessionId,
      path: String(body?.path || ""),
      href: String(body?.href || ""),
      referrer: String(body?.referrer || ""),
      user_agent: String(body?.userAgent || ""),
      language: String(body?.language || ""),
      timezone: String(body?.timezone || ""),
      viewport_width: Number(body?.viewport?.width || 0),
      viewport_height: Number(body?.viewport?.height || 0),
      screen_width: Number(body?.screen?.width || 0),
      screen_height: Number(body?.screen?.height || 0),
      dedupe_bucket: bucket,
      created_at: new Date().toISOString()
    };

    let counted = false;

    try {
      const insertEvent = await supabase
        .from("post_view_events")
        .insert(eventRow);

      if (insertEvent.error) {
        const msg = String(insertEvent.error.message || "");
        if (!msg.toLowerCase().includes("duplicate") && !msg.toLowerCase().includes("unique")) {
          throw insertEvent.error;
        }
      } else {
        counted = true;
      }
    } catch (err) {
      const msg = String((err as Error).message || err || "");
      if (!msg.toLowerCase().includes("duplicate") && !msg.toLowerCase().includes("unique")) {
        throw err;
      }
    }

    const { data: currentRows, error: currentError } = await supabase
      .from("post_views")
      .select("post_id,views")
      .eq("post_id", postId)
      .limit(1);

    if (currentError) throw currentError;

    const currentViews = currentRows && currentRows[0] ? Number(currentRows[0].views || 0) : 0;
    const nextViews = counted ? currentViews + 1 : currentViews;

    await supabase
      .from("post_views")
      .upsert({
        post_id: postId,
        views: nextViews,
        updated_at: new Date().toISOString()
      }, { onConflict: "post_id" });

    return new Response(JSON.stringify({
      ok: true,
      counted,
      views: nextViews
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: String((error as Error).message || error)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
