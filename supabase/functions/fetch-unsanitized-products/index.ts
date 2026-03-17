/**
 * Supabase Edge Function: fetch-unsanitized-products
 *
 * Fetches unsanitized products from pending_products for external AI agents.
 * A product is "fully sanitized" when all 4 required agent statuses are 'complete':
 *   category_status, weight_and_dimension_status, seo_status, faq_status.
 *
 * Returns products where any of these is not 'complete' and fetched_at IS NULL.
 * By default stamps them with fetched_at = NOW() so they aren't returned again.
 * Pass mark_fetched: false to peek without updating fetched_at.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed. Use POST.",
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  try {
    const body = await req.json();
    const batchSize = body.batch_size;
    const markFetched = body.mark_fetched !== false; // defaults to true

    // Validate batch_size
    if (
      batchSize === undefined ||
      batchSize === null ||
      !Number.isInteger(batchSize) ||
      batchSize <= 0
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "'batch_size' is required and must be a positive integer.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // Fetch unsanitized products that haven't been fetched yet
    let products;

    if (markFetched) {
      // Atomic select + stamp so they aren't returned again
      products = await sql`
        WITH batch AS (
          SELECT id
          FROM pending_products
          WHERE fetched_at IS NULL
            AND (
              category_status IS DISTINCT FROM 'complete'
              OR weight_and_dimension_status IS DISTINCT FROM 'complete'
              OR seo_status IS DISTINCT FROM 'complete'
              OR faq_status IS DISTINCT FROM 'complete'
            )
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE pending_products pp
        SET fetched_at = NOW()
        FROM batch
        WHERE pp.id = batch.id
        RETURNING pp.*
      `;
    } else {
      // Read-only peek — no fetched_at update
      products = await sql`
        SELECT *
        FROM pending_products
        WHERE fetched_at IS NULL
          AND (
            category_status IS DISTINCT FROM 'complete'
            OR weight_and_dimension_status IS DISTINCT FROM 'complete'
            OR seo_status IS DISTINCT FROM 'complete'
            OR faq_status IS DISTINCT FROM 'complete'
          )
        ORDER BY created_at ASC
        LIMIT ${batchSize}
      `;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: products.length,
        products,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("fetch-unsanitized-products error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
