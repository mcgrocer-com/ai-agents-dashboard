import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const erpnextBaseUrl =
      Deno.env.get("ERPNEXT_BASE_URL") || "https://erpnext.mcgrocer.com";

    const body = await req.json();
    const urls: string[] = body.urls || [];

    if (!Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "urls array is required and cannot be empty",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[DISABLE] Disabling ${urls.length} products in ERPNext`
    );

    const response = await fetch(
      `${erpnextBaseUrl}/api/method/mcgrocer_customization.apis.item.disable_items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[DISABLE] ERPNext API error (${response.status}): ${errorText}`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: `ERPNext API error (${response.status}): ${errorText}`,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    console.log(
      `[DISABLE] Successfully disabled ${urls.length} products`
    );

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[DISABLE] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
