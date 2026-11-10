alter table public.lumi_shares
  add column original_count smallint not null default 0 check (original_count in (0, 1, 2, 3, 4, 6)),
  add column has_motion boolean not null default true;
