import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TABLE_NAME = "scraped_products";
const BATCH_SIZE = 1000; // Internal batch size for fetching data
const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 10000;

interface FetchRequest {
  vendor: string;
  fields: string[];
  page_size?: number;
  page?: number;
}

interface FetchResponse {
  success: boolean;
  data?: any[];
  metadata?: {
    total_count: number;
    vendor: string;
    fields: string[];
  };
  pagination?: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
  error?: string;
}

/**
 * Transform product data to include variance field instead of variants
 */
function transformProductData(products: any[]): any[] {
  return products.map(product => {
    const transformed = { ...product };

    // Rename variants to variance if it exists
    if (transformed.variants !== undefined) {
      transformed.variance = transformed.variants;
      delete transformed.variants;
    }

    return transformed;
  });
}

/**
 * Validate the request payload
 */
function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.vendor || typeof body.vendor !== "string" || body.vendor.trim() === "") {
    return { valid: false, error: "Missing or invalid 'vendor' field. Must be a non-empty string." };
  }

  if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
    return { valid: false, error: "Missing or invalid 'fields' field. Must be a non-empty array of strings." };
  }

  // Validate that all fields are strings
  for (const field of body.fields) {
    if (typeof field !== "string" || field.trim() === "") {
      return { valid: false, error: "All fields must be non-empty strings." };
    }
  }

  // Validate page_size if provided
  if (body.page_size !== undefined) {
    if (typeof body.page_size !== "number" || body.page_size <= 0) {
      return { valid: false, error: "'page_size' must be a positive number." };
    }
    if (body.page_size > MAX_PAGE_SIZE) {
      return { valid: false, error: `'page_size' cannot exceed ${MAX_PAGE_SIZE}.` };
    }
  }

  // Validate page if provided
  if (body.page !== undefined) {
    if (typeof body.page !== "number" || body.page < 1) {
      return { valid: false, error: "'page' must be a positive number (starting from 1)." };
    }
  }

  return { valid: true };
}

/**
 * Verify custom API key
 */
async function verifyCustomApiKey(
  supabase: any,
  apiKey: string,
): Promise<{ valid: boolean; permissions?: any }> {
  try {
    const { data, error } = await supabase.rpc("verify_api_key", {
      provided_key: apiKey,
    });

    if (error) {
      console.error("RPC error:", error);
      return { valid: false };
    }

    if (!data || data.length === 0) {
      return { valid: false };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
      valid: result.is_valid === true,
      permissions: result.key_permissions,
    };
  } catch (e) {
    console.error("API key verification exception:", e);
    return { valid: false };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify custom API key from X-API-Key header
  const apiKey = req.headers.get("X-API-Key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing X-API-Key header. Custom API key is required.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const { valid, permissions } = await verifyCustomApiKey(supabase, apiKey);
  if (!valid) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid or expired API key.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // Check if API key has permission to select from scraped_products
  const hasPermission = permissions?.scraped_products?.includes("select");
  if (!hasPermission) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "API key does not have permission to read products.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  try {
    // Parse request body
    const requestBody: FetchRequest = await req.json();

    // Validate request
    const validation = validateRequest(requestBody);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const vendor = requestBody.vendor.toLowerCase().trim();
    const fields = requestBody.fields.map(f => f.trim());
    const pageSize = requestBody.page_size;
    const page = requestBody.page;

    // Always include variants field if not already requested
    const fieldsToFetch = [...fields];
    if (!fieldsToFetch.includes('variants')) {
      fieldsToFetch.push('variants');
    }

    // Determine if pagination is requested
    const isPaginated = pageSize !== undefined || page !== undefined;

    if (isPaginated) {
      // Paginated mode: Return specific page
      const actualPageSize = pageSize || DEFAULT_PAGE_SIZE;
      const actualPage = page || 1;

      console.log(`Fetching page ${actualPage} (size: ${actualPageSize}) for vendor: ${vendor}, fields: ${fields.join(", ")}`);

      // Get total count for pagination info
      const { count, error: countError } = await supabase
        .from(TABLE_NAME)
        .select("*", { count: "exact", head: true })
        .eq("vendor", vendor);

      if (countError) {
        console.error("Error getting count:", countError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to get total count: ${countError.message}`,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      const totalCount = count || 0;

      // Calculate pagination
      const startIndex = (actualPage - 1) * actualPageSize;
      const endIndex = startIndex + actualPageSize - 1;

      // Fetch data with selected fields
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(fieldsToFetch.join(", "))
        .eq("vendor", vendor)
        .range(startIndex, endIndex);

      if (error) {
        console.error("Error fetching data:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to fetch data: ${error.message}`,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      console.log(`Fetched ${data?.length || 0} products for page ${actualPage}`);

      // Transform data to include variance field
      const transformedData = transformProductData(data || []);

      // Build paginated response
      const response: FetchResponse = {
        success: true,
        data: transformedData,
        pagination: {
          page: actualPage,
          page_size: actualPageSize,
          total_count: totalCount,
          total_pages: Math.ceil(totalCount / actualPageSize),
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else {
      // Fetch all mode: Return all records
      console.log(`Fetching all products for vendor: ${vendor}, fields: ${fields.join(", ")}`);

      // Get total count first
      const { count, error: countError } = await supabase
        .from(TABLE_NAME)
        .select("*", { count: "exact", head: true })
        .eq("vendor", vendor);

      if (countError) {
        console.error("Error getting count:", countError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to get total count: ${countError.message}`,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      const totalCount = count || 0;
      console.log(`Total products to fetch: ${totalCount}`);

      // Fetch all data in batches
      const allData: any[] = [];
      let currentIndex = 0;

      while (currentIndex < totalCount) {
        const endIndex = currentIndex + BATCH_SIZE - 1;

        console.log(`Fetching batch: ${currentIndex} to ${endIndex}`);

        const { data, error } = await supabase
          .from(TABLE_NAME)
          .select(fieldsToFetch.join(", "))
          .eq("vendor", vendor)
          .range(currentIndex, endIndex);

        if (error) {
          console.error(`Error fetching batch at index ${currentIndex}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to fetch data at batch ${currentIndex}: ${error.message}`,
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        if (data && data.length > 0) {
          allData.push(...data);
          console.log(`Fetched ${data.length} products. Total so far: ${allData.length}`);
        }

        // Break if we got fewer results than expected (end of data)
        if (!data || data.length < BATCH_SIZE) {
          break;
        }

        currentIndex += BATCH_SIZE;
      }

      console.log(`Completed fetching all ${allData.length} products for vendor: ${vendor}`);

      // Transform data to include variance field
      const transformedAllData = transformProductData(allData);

      // Build response with metadata (no pagination info)
      const response: FetchResponse = {
        success: true,
        data: transformedAllData,
        metadata: {
          total_count: transformedAllData.length,
          vendor,
          fields,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
