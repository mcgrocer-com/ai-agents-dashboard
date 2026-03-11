import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Allowed fields that can be exported (whitelist to prevent data leakage)
const ALLOWED_FIELDS_SP = new Set([
  "id", "url", "product_id", "vendor", "name", "price", "original_price",
  "main_image", "category", "stock_status", "ean_code", "created_at", "updated_at",
]);
const ALLOWED_FIELDS_PP = new Set(["validation_error"]);

// Map error_category to SQL LIKE pattern
const ERROR_CATEGORY_PATTERNS: Record<string, string> = {
  http_error: "Main image HTTP %",
  timeout: "Main image timeout%",
  unreachable: "Main image unreachable%",
  post_processing: "Post-processing%",
  image_mismatch: "Image mismatch%",
};

interface ExportRequest {
  fields: string[];
  error_category?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  try {
    const body: ExportRequest = await req.json();

    // Validate fields
    if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "'fields' must be a non-empty array of strings." }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Split requested fields into scraped_products vs pending_products columns
    const spFields: string[] = [];
    const ppFields: string[] = [];
    for (const f of body.fields) {
      if (ALLOWED_FIELDS_SP.has(f)) spFields.push(f);
      else if (ALLOWED_FIELDS_PP.has(f)) ppFields.push(f);
      // Silently ignore unknown fields
    }

    if (spFields.length === 0 && ppFields.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid fields provided." }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Validate error_category
    const errorCategory = body.error_category || null;
    if (errorCategory && !ERROR_CATEGORY_PATTERNS[errorCategory]) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid error_category: '${errorCategory}'.` }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Build SQL select columns
    const selectCols = [
      ...spFields.map((f) => `sp.${f}`),
      ...ppFields.map((f) => `pp.${f}`),
    ].join(", ");

    // Build WHERE clause
    let whereClause = "pp.validation_error IS NOT NULL";
    const params: unknown[] = [];
    if (errorCategory) {
      params.push(ERROR_CATEGORY_PATTERNS[errorCategory]);
      whereClause += ` AND pp.validation_error LIKE $${params.length}`;
    }

    const sql = `
      SELECT ${selectCols}
      FROM pending_products pp
      INNER JOIN scraped_products sp ON sp.id = pp.scraped_product_id
      WHERE ${whereClause}
      ORDER BY pp.updated_at DESC
    `;

    console.log(`[export-validation-errors] Executing query for ${body.fields.length} fields, category: ${errorCategory || "all"}`);

    // Use postgres.js for unlimited result sets (no Supabase client row cap)
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const pgSql = postgres(databaseUrl, { max: 1 });

    try {
      const rows = errorCategory
        ? await pgSql.unsafe(sql, params)
        : await pgSql.unsafe(sql);

      console.log(`[export-validation-errors] Returning ${rows.length} products`);

      return new Response(
        JSON.stringify({ success: true, data: rows, total_count: rows.length }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    } finally {
      await pgSql.end();
    }
  } catch (error) {
    console.error("[export-validation-errors] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }
});
