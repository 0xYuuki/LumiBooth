alter table lumi_commerce.print_products
  add column buyer_instructions text
    check (length(btrim(buyer_instructions)) between 1 and 1200),
  add column safe_inset_px integer not null default 0
    check (safe_inset_px between 0 and 4096
      and (safe_inset_px + bleed_px) * 2 < least(width_px, height_px));
