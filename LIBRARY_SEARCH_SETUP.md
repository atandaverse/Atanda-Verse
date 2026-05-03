## Library Search Backend Setup

This adds Supabase-backed fuzzy search for the public Library page.

The frontend will call this database function first when a visitor searches the Library. If the function is not installed yet, the page safely falls back to the built-in keyword search.

### 1. Run This SQL In Supabase

Open Supabase SQL Editor and run:

```sql
create extension if not exists pg_trgm;

create index if not exists library_search_trgm_idx
on public.library
using gin (
  (lower(
    coalesce(title, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(tag, '') || ' ' ||
    coalesce(status, '') || ' ' ||
    coalesce(notes, '')
  )) gin_trgm_ops
);

create index if not exists library_search_tsv_idx
on public.library
using gin (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(tag, '') || ' ' ||
    coalesce(status, '') || ' ' ||
    coalesce(notes, '')
  )
);

create or replace function public.search_library_resources(
  search_query text,
  category_filter text default null,
  status_filter text default null,
  result_limit integer default 60
)
returns table (
  id text,
  title text,
  category text,
  description text,
  emoji text,
  tag text,
  status text,
  url text,
  image text,
  embed text,
  preview text,
  duration text,
  sort_order integer,
  featured boolean,
  free boolean,
  notes text,
  search_rank real
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(search_query, '')));
  expanded text := lower(trim(coalesce(search_query, '')));
begin
  if q = '' then
    return query
    select
      l.id, l.title, l.category, l.description, l.emoji, l.tag, l.status,
      l.url, l.image, l.embed, l.preview, l.duration, l.sort_order,
      l.featured, l.free, l.notes, 0::real as search_rank
    from public.library l
    where (category_filter is null or category_filter = '' or l.category = category_filter)
      and (status_filter is null or status_filter = '' or l.status = status_filter)
    order by l.featured desc, l.sort_order asc, l.title asc
    limit greatest(1, least(coalesce(result_limit, 60), 100));
    return;
  end if;

  if q ~ '(stuck|lost|fog|foggy|confus|unclear|overthink|focus|decision|mental|mind)' then
    expanded := expanded || ' clarity clear mental fog focus direction framework challenge';
  end if;

  if q ~ '(anxious|anxiety|overwhelm|stress|panic|worried|calm|breath|ground|release)' then
    expanded := expanded || ' anxiety release practice meditation breathing grounding calm audio';
  end if;

  if q ~ '(career|work|job|graduate|skill|employment|business|phase|direction)' then
    expanded := expanded || ' career work job skill graduate direction life mapping';
  end if;

  if q ~ '(purpose|mission|meaning|vision|values|calling|identity|self|understand)' then
    expanded := expanded || ' purpose meaning vision values identity patterns framework';
  end if;

  if q ~ '(relationship|love|friendship|connection|boundar|pattern)' then
    expanded := expanded || ' relationship connection boundaries patterns support growth';
  end if;

  if q ~ '(habit|routine|discipline|consistent|consistency|change|progress|motivation)' then
    expanded := expanded || ' habits consistency progress change atomic small routine';
  end if;

  if q ~ '(money|financial|finance|adult|adulting|responsibility|saving|spending)' then
    expanded := expanded || ' money financial responsibility adult decisions psychology';
  end if;

  if q ~ '(book|read|reading|author|deep|deeper)' then
    expanded := expanded || ' books reading author curated deeper insight';
  end if;

  if q ~ '(audio|listen|meditation|practice|exercise|breath)' then
    expanded := expanded || ' audio listen meditation practice breathing exercise';
  end if;

  if q ~ '(workbook|worksheet|journal|journaling|reflection|mapping)' then
    expanded := expanded || ' workbook worksheet reflection journal mapping';
  end if;

  if q ~ '(video|watch|workshop|talk|orientation)' then
    expanded := expanded || ' video workshop orientation watch talk';
  end if;

  return query
  with base as (
    select
      l.*,
      lower(
        coalesce(l.title, '') || ' ' ||
        coalesce(l.category, '') || ' ' ||
        coalesce(l.description, '') || ' ' ||
        coalesce(l.tag, '') || ' ' ||
        coalesce(l.status, '') || ' ' ||
        coalesce(l.notes, '')
      ) as search_blob
    from public.library l
    where (category_filter is null or category_filter = '' or l.category = category_filter)
      and (status_filter is null or status_filter = '' or l.status = status_filter)
  ),
  ranked as (
    select
      b.*,
      (
        case when b.search_blob like '%' || q || '%' then 8 else 0 end
        + similarity(b.search_blob, q) * 4
        + ts_rank_cd(
            to_tsvector('english', b.search_blob),
            websearch_to_tsquery('english', expanded)
          ) * 10
        + case when exists (
            select 1
            from regexp_split_to_table(expanded, '\s+') as term
            where length(term) > 2
              and b.search_blob like '%' || term || '%'
          ) then 2 else 0 end
      )::real as rank_score
    from base b
  )
  select
    r.id, r.title, r.category, r.description, r.emoji, r.tag, r.status,
    r.url, r.image, r.embed, r.preview, r.duration, r.sort_order,
    r.featured, r.free, r.notes, r.rank_score as search_rank
  from ranked r
  where r.rank_score > 0
  order by r.rank_score desc, r.featured desc, r.sort_order asc, r.title asc
  limit greatest(1, least(coalesce(result_limit, 60), 100));
end;
$$;

grant execute on function public.search_library_resources(text, text, text, integer) to anon, authenticated;
```

### 2. What This Improves

- Searches no longer depend only on exact title words.
- Supabase ranks results by title/description/tag/status/notes relevance.
- Related searches like `stuck`, `mental fog`, `adulting`, `listen`, `read`, `career`, and `purpose` can surface matching resources.
- The public Library page still has a safe local fallback if Supabase is unavailable.

### 3. Optional Admin Step

After running the SQL, open Workspace and use:

`Settings -> Restore Library to Supabase`

That makes sure the curated reading defaults are present in the database too.
