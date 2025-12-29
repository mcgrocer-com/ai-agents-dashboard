-- Export products with names longer than 140 characters
COPY (
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT
      id,
      product_id,
      vendor,
      name,
      LENGTH(name) as name_length,
      ai_title,
      SUBSTRING(description, 1, 500) as description_preview,
      price,
      url,
      status,
      category,
      breadcrumbs
    FROM scraped_products
    WHERE LENGTH(name) > 140
    ORDER BY LENGTH(name) DESC
  ) t
) TO STDOUT;