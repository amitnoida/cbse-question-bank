-- Admin-only preparation for Release C. No student entitlement or checkout changes.
create table public.admin_subscription_products (
  code text primary key check (code in ('CLASS_8','CLASS_9','CLASS_10','CLASS_11','CLASS_12','COMBO_9_10','COMBO_11_12')),
  name text not null check (length(btrim(name)) between 1 and 120),
  class_numbers integer[] not null,
  price_inr numeric(10,2) check (price_inr >= 0 and price_inr <= 999999.99),
  description text not null default '' check (length(description) <= 1000),
  status text not null default 'draft' check (status in ('draft','ready')),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (status <> 'ready' or price_inr is not null),
  check (class_numbers = case code
    when 'CLASS_8' then array[8] when 'CLASS_9' then array[9]
    when 'CLASS_10' then array[10] when 'CLASS_11' then array[11]
    when 'CLASS_12' then array[12] when 'COMBO_9_10' then array[9,10]
    when 'COMBO_11_12' then array[11,12] end)
);
create table public.admin_subscription_product_audit (
  id bigint generated always as identity primary key,
  product_code text not null references public.admin_subscription_products(code),
  actor_id uuid not null,
  before_value jsonb not null,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
create index admin_subscription_audit_product_idx on public.admin_subscription_product_audit(product_code, created_at desc);
alter table public.admin_subscription_products enable row level security;
alter table public.admin_subscription_product_audit enable row level security;
-- Deliberately no client policies: all access passes the Full Admin server guard.
revoke all on public.admin_subscription_products, public.admin_subscription_product_audit from public, anon, authenticated;
grant select, update on public.admin_subscription_products to service_role;
grant select, insert on public.admin_subscription_product_audit to service_role;
grant usage, select on sequence public.admin_subscription_product_audit_id_seq to service_role;
insert into public.admin_subscription_products(code,name,class_numbers,description) values
 ('CLASS_8','Class 8 membership',array[8],'Practice and Real Mock'),
 ('CLASS_9','Class 9 membership',array[9],'Practice and Real Mock'),
 ('CLASS_10','Class 10 membership',array[10],'Practice and Real Mock'),
 ('CLASS_11','Class 11 membership',array[11],'Practice and Real Mock'),
 ('CLASS_12','Class 12 membership',array[12],'Practice and Real Mock'),
 ('COMBO_9_10','Classes 9 + 10 membership',array[9,10],'Practice and Real Mock for both classes'),
 ('COMBO_11_12','Classes 11 + 12 membership',array[11,12],'Practice and Real Mock for both classes');
create function public.admin_save_subscription_product_v1(
 p_actor uuid, p_code text, p_revision integer, p_name text,
 p_price numeric, p_description text, p_status text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare old_row public.admin_subscription_products; new_row public.admin_subscription_products;
begin
 if not exists (
   select 1 from public.admin_profiles p join public.admin_users u on u.user_id=p.id
   where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password
 ) then raise exception 'Full Admin permission required' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 120
   or p_description is null or length(p_description)>1000
   or p_status is null or p_status not in ('draft','ready')
   or (p_price is not null and (p_price<0 or p_price>999999.99 or p_price<>round(p_price,2)))
   or (p_status='ready' and p_price is null) then
   raise exception 'Invalid product details' using errcode='22023';
 end if;
 select * into old_row from public.admin_subscription_products where code=p_code for update;
 if not found then raise exception 'Unknown product' using errcode='P0002'; end if;
 if p_revision is null or old_row.revision<>p_revision then
   raise exception 'Product changed. Reload before saving.' using errcode='40001';
 end if;
 update public.admin_subscription_products set name=btrim(p_name),price_inr=p_price,
 description=p_description,status=p_status,revision=revision+1,updated_at=now(),updated_by=p_actor
 where code=p_code returning * into new_row;
 insert into public.admin_subscription_product_audit(product_code,actor_id,before_value,after_value)
 values(p_code,p_actor,to_jsonb(old_row),to_jsonb(new_row));
 return to_jsonb(new_row);
end;
$$;
revoke all on function public.admin_save_subscription_product_v1(uuid,text,integer,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.admin_save_subscription_product_v1(uuid,text,integer,text,numeric,text,text) to service_role;
