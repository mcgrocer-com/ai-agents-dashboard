-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- Create table for product description chunks with embeddings
create table if not exists product_description_chunks (
  id bigserial primary key,
  product_id text not null, -- Primary identifier from scraped_products (not item_code which is assigned by ERPNext)
  chunk_text text not null,
  chunk_index int not null,
  chunk_type text check (chunk_type in ('weight', 'dimension', 'material', 'features', 'general')),
  embedding vector(768), -- Google text-embedding-004 dimensions
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Ensure unique chunks per product
  unique(product_id, chunk_index)
);

-- Indexes for fast similarity search
create index if not exists product_description_chunks_embedding_idx
on product_description_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Index for filtering by product
create index if not exists product_description_chunks_product_id_idx
on product_description_chunks(product_id);

-- Index for filtering by chunk type
create index if not exists product_description_chunks_chunk_type_idx
on product_description_chunks(chunk_type);

-- Composite index for common queries
create index if not exists product_description_chunks_product_type_idx
on product_description_chunks(product_id, chunk_type);

-- RPC function for semantic similarity search within a product's chunks
create or replace function match_description_chunks(
  query_embedding vector(768),
  target_product_id text,
  match_count int default 5,
  chunk_types_filter text[] default null,
  similarity_threshold float default 0.5
)
returns table (
  chunk_text text,
  chunk_type text,
  chunk_index int,
  similarity float
)
language plpgsql stable
as $$
begin
  return query
  select
    pdc.chunk_text,
    pdc.chunk_type,
    pdc.chunk_index,
    1 - (pdc.embedding <=> query_embedding) as similarity
  from product_description_chunks pdc
  where pdc.product_id = target_product_id
    and pdc.embedding is not null
    and (chunk_types_filter is null or pdc.chunk_type = any(chunk_types_filter))
    and 1 - (pdc.embedding <=> query_embedding) >= similarity_threshold
  order by pdc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Helper function to get all chunks for a product (for debugging)
create or replace function get_product_chunks(
  target_product_id text
)
returns table (
  chunk_text text,
  chunk_type text,
  chunk_index int
)
language sql stable
as $$
  select
    chunk_text,
    chunk_type,
    chunk_index
  from product_description_chunks
  where product_id = target_product_id
  order by chunk_index;
$$;

-- Optional: Add embedding column to scraped_products table for full-text embeddings
-- This allows searching across all products, not just within a single product
alter table scraped_products
add column if not exists description_embedding vector(768);

-- Index for product-level embeddings
create index if not exists scraped_products_description_embedding_idx
on scraped_products
using ivfflat (description_embedding vector_cosine_ops)
with (lists = 100);

-- Function to find similar products by description
create or replace function match_similar_products(
  query_embedding vector(768),
  match_count int default 10,
  similarity_threshold float default 0.7
)
returns table (
  item_code text,
  name text,
  description text,
  similarity float
)
language sql stable
as $$
  select
    product_id as item_code,
    name,
    description,
    1 - (description_embedding <=> query_embedding) as similarity
  from scraped_products
  where description_embedding is not null
    and 1 - (description_embedding <=> query_embedding) >= similarity_threshold
  order by description_embedding <=> query_embedding
  limit match_count;
$$;

-- Grant permissions (adjust role as needed)
grant select, insert, update, delete on product_description_chunks to service_role;
grant usage on sequence product_description_chunks_id_seq to service_role;
grant execute on function match_description_chunks to service_role;
grant execute on function get_product_chunks to service_role;
grant execute on function match_similar_products to service_role;

-- Create updated_at trigger for product_description_chunks
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_product_description_chunks_updated_at
  before update on product_description_chunks
  for each row
  execute function update_updated_at_column();

-- Add comment for documentation
comment on table product_description_chunks is
'Stores semantic chunks of product descriptions with embeddings for efficient retrieval of specific information (weight, dimensions, materials, etc.)';

comment on column product_description_chunks.chunk_type is
'Type of information in this chunk: weight, dimension, material, features, or general';

comment on column product_description_chunks.embedding is
'768-dimensional vector embedding from Google text-embedding-004 model';
