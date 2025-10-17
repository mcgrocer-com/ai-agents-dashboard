-- Update match_description_chunks RPC function to support scraped_product_id
-- and maintain backward compatibility with product_id + url

-- Drop old function
drop function if exists match_description_chunks(vector, text, int, text[], float);

-- Create updated function with scraped_product_id support
create or replace function match_description_chunks(
  query_embedding vector(768),
  target_scraped_product_id text default null,
  target_product_id text default null,
  target_url text default null,
  match_count int default 5,
  chunk_types_filter text[] default null,
  similarity_threshold float default 0.5
)
returns table (
  chunk_text text,
  chunk_type text,
  chunk_index int,
  similarity float,
  product_id text,
  scraped_product_id text,
  url text
)
language plpgsql stable
as $$
begin
  -- Priority: scraped_product_id > (product_id + url)
  -- Never allow product_id without url

  if target_scraped_product_id is not null then
    -- PRIMARY METHOD: Use scraped_product_id
    return query
    select
      pdc.chunk_text,
      pdc.chunk_type,
      pdc.chunk_index,
      1 - (pdc.embedding <=> query_embedding) as similarity,
      pdc.product_id,
      pdc.scraped_product_id,
      pdc.url
    from product_description_chunks pdc
    where pdc.scraped_product_id = target_scraped_product_id
      and pdc.embedding is not null
      and (chunk_types_filter is null or pdc.chunk_type = any(chunk_types_filter))
      and 1 - (pdc.embedding <=> query_embedding) >= similarity_threshold
    order by pdc.embedding <=> query_embedding
    limit match_count;

  elsif target_product_id is not null and target_url is not null then
    -- FALLBACK METHOD: Use product_id + url (both required)
    return query
    select
      pdc.chunk_text,
      pdc.chunk_type,
      pdc.chunk_index,
      1 - (pdc.embedding <=> query_embedding) as similarity,
      pdc.product_id,
      pdc.scraped_product_id,
      pdc.url
    from product_description_chunks pdc
    where pdc.product_id = target_product_id
      and pdc.url = target_url
      and pdc.embedding is not null
      and (chunk_types_filter is null or pdc.chunk_type = any(chunk_types_filter))
      and 1 - (pdc.embedding <=> query_embedding) >= similarity_threshold
    order by pdc.embedding <=> query_embedding
    limit match_count;

  else
    -- ERROR: Invalid parameters
    raise exception 'Must provide either target_scraped_product_id OR (target_product_id AND target_url). Never use product_id alone!';
  end if;
end;
$$;

-- Update get_product_chunks helper function to support scraped_product_id
drop function if exists get_product_chunks(text);

create or replace function get_product_chunks(
  target_scraped_product_id text default null,
  target_product_id text default null,
  target_url text default null
)
returns table (
  chunk_text text,
  chunk_type text,
  chunk_index int,
  scraped_product_id text
)
language plpgsql stable
as $$
begin
  if target_scraped_product_id is not null then
    return query
    select
      pdc.chunk_text,
      pdc.chunk_type,
      pdc.chunk_index,
      pdc.scraped_product_id
    from product_description_chunks pdc
    where pdc.scraped_product_id = target_scraped_product_id
    order by pdc.chunk_index;

  elsif target_product_id is not null and target_url is not null then
    return query
    select
      pdc.chunk_text,
      pdc.chunk_type,
      pdc.chunk_index,
      pdc.scraped_product_id
    from product_description_chunks pdc
    where pdc.product_id = target_product_id
      and pdc.url = target_url
    order by pdc.chunk_index;

  else
    raise exception 'Must provide either target_scraped_product_id OR (target_product_id AND target_url)';
  end if;
end;
$$;

-- Grant permissions
grant execute on function match_description_chunks to service_role;
grant execute on function match_description_chunks to anon;
grant execute on function match_description_chunks to authenticated;

grant execute on function get_product_chunks to service_role;
grant execute on function get_product_chunks to anon;
grant execute on function get_product_chunks to authenticated;

-- Add comments
comment on function match_description_chunks is
'Semantic search for product description chunks. ALWAYS use target_scraped_product_id as primary identifier. Only use target_product_id+target_url as fallback. Never use product_id alone!';

comment on function get_product_chunks is
'Get all chunks for a product by scraped_product_id (primary) or product_id+url (fallback)';
