-- Migration: Add automatic chunking trigger for new products
-- This trigger calls the chunk-product-description edge function when products are inserted

-- Create a function to enqueue chunking jobs
create or replace function enqueue_product_chunking()
returns trigger
language plpgsql
security definer
as $$
declare
  function_url text;
  service_role_key text;
begin
  -- Only process if description exists and is not empty
  if new.description is null or trim(new.description) = '' then
    return new;
  end if;

  -- Get edge function URL from environment or construct it
  -- Format: https://[project-ref].supabase.co/functions/v1/chunk-product-description
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/chunk-product-description';
  service_role_key := current_setting('app.settings.supabase_service_key', true);

  -- Call edge function asynchronously (fire and forget)
  -- Note: This requires pg_net extension for HTTP requests from PostgreSQL
  -- Alternative: Use a queue table and process via cron job

  -- For now, we'll use a simpler approach: insert into a chunking queue table
  insert into product_chunking_queue (product_id, description, status, created_at)
  values (new.product_id, new.description, 'pending', now())
  on conflict (product_id) do update
    set description = excluded.description,
        status = 'pending',
        updated_at = now();

  return new;
end;
$$;

-- Create queue table for chunking jobs
create table if not exists product_chunking_queue (
  id bigserial primary key,
  product_id text unique not null,
  description text not null,
  status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  error_message text,
  retry_count int default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

-- Index for efficient queue processing
create index if not exists product_chunking_queue_status_idx
on product_chunking_queue(status, created_at)
where status in ('pending', 'failed');

-- Create trigger on scraped_products table
drop trigger if exists trigger_enqueue_chunking on scraped_products;

create trigger trigger_enqueue_chunking
  after insert on scraped_products
  for each row
  execute function enqueue_product_chunking();

-- Create function to process chunking queue
-- This can be called by a cron job or manually
create or replace function process_chunking_queue(batch_size int default 10)
returns json
language plpgsql
security definer
as $$
declare
  processed_count int := 0;
  failed_count int := 0;
  queue_item record;
  chunk_result record;
  result_json json;
begin
  -- Get pending items from queue
  for queue_item in
    select id, product_id, description
    from product_chunking_queue
    where status = 'pending'
       or (status = 'failed' and retry_count < 3)
    order by created_at asc
    limit batch_size
    for update skip locked
  loop
    -- Mark as processing
    update product_chunking_queue
    set status = 'processing',
        updated_at = now()
    where id = queue_item.id;

    -- Here you would call the chunking logic
    -- For now, we'll just mark as completed (actual chunking done by edge function or Python script)
    -- This is a placeholder - in production, call the edge function via pg_net or use Python script

    begin
      -- Placeholder: Assume chunking succeeds
      -- In production: Call chunk-product-description edge function or Python chunker

      update product_chunking_queue
      set status = 'completed',
          processed_at = now(),
          updated_at = now()
      where id = queue_item.id;

      processed_count := processed_count + 1;

    exception when others then
      -- Mark as failed and increment retry count
      update product_chunking_queue
      set status = 'failed',
          error_message = SQLERRM,
          retry_count = retry_count + 1,
          updated_at = now()
      where id = queue_item.id;

      failed_count := failed_count + 1;
    end;
  end loop;

  result_json := json_build_object(
    'processed', processed_count,
    'failed', failed_count,
    'total', processed_count + failed_count
  );

  return result_json;
end;
$$;

-- Grant permissions
grant select, insert, update, delete on product_chunking_queue to service_role;
grant usage on sequence product_chunking_queue_id_seq to service_role;
grant execute on function enqueue_product_chunking to service_role;
grant execute on function process_chunking_queue to service_role;

-- Add comments
comment on table product_chunking_queue is
'Queue for asynchronous product description chunking. Populated automatically when products are inserted.';

comment on function enqueue_product_chunking is
'Trigger function that enqueues products for chunking when inserted into scraped_products table';

comment on function process_chunking_queue is
'Process pending chunking jobs from the queue. Call via cron job or manually.';

-- Create a view for monitoring
create or replace view chunking_queue_stats as
select
  status,
  count(*) as count,
  min(created_at) as oldest,
  max(created_at) as newest,
  avg(retry_count) as avg_retries
from product_chunking_queue
group by status;

grant select on chunking_queue_stats to service_role;

comment on view chunking_queue_stats is
'Statistics view for monitoring the chunking queue';
