with runs as (
  select n.id, n.ticker_id, t.symbol, t.name as ticker_name, n.created_at, n.subject, n.model
  from mediapulse.newsletter n join mediapulse.ticker t on t.id=n.ticker_id
  where n.created_at > now() - interval '14 days'
),
pooled as (
  select r.*,
    (select count(*) from mediapulse.data_source_ticker_section dts
      where dts.ticker_id=r.ticker_id and dts.section is not null
        and dts.analyzed_at >= r.created_at - interval '48 hours' and dts.analyzed_at < r.created_at) as pool_size
  from runs r
),
dropped as (
  select distinct s.newsletter_id
  from mediapulse.newsletter_section s
  join mediapulse.newsletter_section_item i on i.section_id=s.id
  join mediapulse.data_source ds on ds.id=i.data_source_id
  where ds.content is not null
    and ds.content ~ '(Rp *[0-9]|[0-9]+,[0-9]+ *(triliun|miliar|juta)|[0-9]+,[0-9]+ *persen|[0-9]+,[0-9]+%)'
    and array_to_string(i.points, ' ') !~ '[0-9]'
),
dcii as (select id, symbol, created_at, pool_size, subject, 'dcii' as stratum from pooled where id in ('68ae59d1-43f8-4e25-a64b-fb1df8aea5e4','679826c3-48d9-4d30-983c-634c5ebd52c9','8b3906eb-a139-4808-a22b-16cf0d1d39ef','a094e1eb-323b-4a0c-b6ed-6e8a9837e745')),
big as (select id, symbol, created_at, pool_size, subject, 'big_pool' as stratum from pooled
        where pool_size >= 40 and symbol <> 'DCII' order by id limit 10),
mid as (select id, symbol, created_at, pool_size, subject, 'mid_pool' as stratum from pooled
        where pool_size between 10 and 39 and symbol <> 'DCII' order by id limit 8),
drp as (select p.id, p.symbol, p.created_at, p.pool_size, p.subject, 'figure_drop' as stratum from pooled p
        join dropped d on d.newsletter_id=p.id
        where p.symbol <> 'DCII'
          and p.id not in (select id from big) and p.id not in (select id from mid)
        order by p.id limit 8),
cases as (
  select * from dcii union all select * from big union all select * from mid union all select * from drp
)
select json_agg(row_to_json(x)) from (
  select c.id as case_id, c.symbol, c.stratum, c.pool_size,
         to_char(c.created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as run_at,
         c.subject as shipped_subject,
         (select t.name from mediapulse.ticker t where t.id=(select ticker_id from runs where id=c.id)) as ticker_name,
         (select tp.competitors from mediapulse.ticker_profile tp where tp.ticker_id=(select ticker_id from runs where id=c.id)) as competitors,
         (select brief from orchestration.agent_contract where name='MediaPulse Industry Intelligence Briefing' limit 1) as brief,
         (select json_agg(row_to_json(rb))
          from (
            select s2.section_key as "sectionKey", unnest(i2.points) as "bulletText"
            from mediapulse.newsletter n2
            join mediapulse.newsletter_section s2 on s2.newsletter_id=n2.id
            join mediapulse.newsletter_section_item i2 on i2.section_id=s2.id
            where n2.ticker_id=(select ticker_id from runs where id=c.id)
              and n2.created_at < c.created_at
              and n2.created_at >= c.created_at - interval '14 days'
          ) rb) as recent_bullets,
         (select to_jsonb(array(select distinct e from unnest(
            array[t.symbol, t.name] || coalesce(t.aliases,'{}') || coalesce(tp.aliases,'{}')
          ) as e where e is not null and length(e) > 2))
          from mediapulse.ticker t
          left join mediapulse.ticker_profile tp on tp.ticker_id = t.id
          where t.id = (select ticker_id from runs where id=c.id)) as aliases,
         (select json_agg(row_to_json(p) order by p."sectionScore" desc nulls last)
          from (
            select ds.id as "dataSourceId", ds.url, ds.title,
                   coalesce(ds.content, ds.description, '') as content,
                   (ds.content is null or btrim(ds.content)='') as "contentIsDescriptionOnly",
                   ds.author, ds.source,
                   to_char(ds.published_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "publishedAt",
                   dts.section, dts.section_score as "sectionScore",
                   da.open_page_rank as "publisherAuthority"
            from mediapulse.data_source_ticker_section dts
            join mediapulse.data_source ds on ds.id=dts.data_source_id
            left join mediapulse.domain_authority da on da.domain = ds.registrable_domain
            where dts.ticker_id=(select ticker_id from runs where id=c.id)
              and dts.section is not null
              and dts.analyzed_at >= c.created_at - interval '48 hours'
              and dts.analyzed_at < c.created_at
          ) p) as pool,
         (select json_agg(row_to_json(si))
          from (
            select i.title, i.points, i.url, i.data_source_id as "dataSourceId", s.section_key as "sectionKey"
            from mediapulse.newsletter_section s
            join mediapulse.newsletter_section_item i on i.section_id=s.id
            where s.newsletter_id=c.id
          ) si) as shipped_items
  from cases c
) x;
