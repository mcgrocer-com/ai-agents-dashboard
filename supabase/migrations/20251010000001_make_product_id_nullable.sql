-- Make product_id nullable in product_description_chunks
-- product_id is the vendor's product ID which may not always be available
-- scraped_product_id is the required FK to scraped_products.id

alter table product_description_chunks
  alter column product_id drop not null;

-- Add comment explaining the column purpose
comment on column product_description_chunks.product_id is
  'Optional vendor product ID. Use scraped_product_id as primary identifier.';
