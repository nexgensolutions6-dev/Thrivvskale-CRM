-- ThrivvSkale CRM: lead search (Task 14).
--
-- search_leads(ws, q, lim) returns the companies of workspace `ws` that match
-- the text `q` in the company name, area, tags, or the name / name_latin of
-- any of its contacts. Telugu and Devanagari names are found through
-- name_latin ("ramesh" finds the contact written in either script).
--
-- Security: SECURITY INVOKER, so row-level security on companies and contacts
-- applies to the caller. The explicit is_member(ws) check makes "only your own
-- workspace" visible in the function itself; asking for someone else's
-- workspace id returns nothing.
--
-- Matching (see search_match_score): substring first, then whole-word 'simple'
-- text search, then pg_trgm word similarity for typos ("ramsh" finds "ramesh").
-- It scans the caller's workspace rows; fine for thousands of leads. Add a
-- trigram index on the searched columns if a workspace ever grows far beyond that.

-- Score in [0, 1] for how well `hay` matches the search text `needle`; 0 = no match.
create function public.search_match_score(needle text, hay text)
returns real
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when needle is null or hay is null or btrim(needle) = '' then 0::real
    when position(lower(btrim(needle)) in lower(hay)) > 0 then 1.0::real
    when to_tsvector('simple', hay) @@ plainto_tsquery('simple', needle) then 0.9::real
    -- Typo tolerance only for queries of 4+ characters; shorter ones match too much.
    when char_length(btrim(needle)) >= 4
      and extensions.word_similarity(btrim(needle), hay) >= 0.45
      then extensions.word_similarity(btrim(needle), hay)
    else 0::real
  end;
$$;

create function public.search_leads(ws uuid, q text, lim integer default 30)
returns setof public.companies
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
  from (
    select
      co.id,
      greatest(
        public.search_match_score(q, co.name),
        public.search_match_score(q, co.area),
        public.search_match_score(q, array_to_string(co.tags, ' ')),
        coalesce((
          select max(greatest(
            public.search_match_score(q, k.name),
            public.search_match_score(q, k.name_latin)
          ))
          from public.contacts k
          where k.workspace_id = co.workspace_id and k.company_id = co.id
        ), 0::real)
      ) as score
    from public.companies co
    where co.workspace_id = ws
      and public.is_member(ws)
      and btrim(coalesce(q, '')) <> ''
  ) ranked
  join public.companies c on c.id = ranked.id
  where ranked.score > 0
  order by ranked.score desc, c.base_score desc, c.name
  limit greatest(1, least(coalesce(lim, 30), 100));
$$;

revoke execute on function public.search_match_score(text, text) from public, anon;
grant execute on function public.search_match_score(text, text) to authenticated, service_role;
revoke execute on function public.search_leads(uuid, text, integer) from public, anon;
grant execute on function public.search_leads(uuid, text, integer) to authenticated;
