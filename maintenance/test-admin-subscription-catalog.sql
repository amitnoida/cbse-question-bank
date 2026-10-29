-- QA assertions run in a subtransaction and deliberately roll back all writes.
do $$
declare actor uuid; viewer uuid;
 p public.admin_subscription_products; saved jsonb; audit_before bigint;
begin
 select id into actor from auth.users where email='test_admin_fullaccess@gmail.com';
 select id into viewer from auth.users where email='test_admin_viewer@gmail.com';
 if actor is null or viewer is null then raise exception 'Dedicated QA identities missing'; end if;
 begin
 execute 'set local role service_role';
 select * into strict p from public.admin_subscription_products where code='CLASS_8';
 select count(*) into audit_before from public.admin_subscription_product_audit;
 saved:=public.admin_save_subscription_product_v1(actor,p.code,p.revision,'QA rollback plan',123.45,'QA only','ready');
 if saved->>'price_inr'<>'123.45' or (saved->>'revision')::integer<>p.revision+1 then raise exception 'Save failed'; end if;
 if (select count(*) from public.admin_subscription_product_audit)<>audit_before+1 then raise exception 'Audit failed'; end if;
 begin
   perform public.admin_save_subscription_product_v1(actor,p.code,p.revision,p.name,99,'','draft');
   raise exception 'Stale save accepted';
 exception when serialization_failure then null; end;
 begin
   perform public.admin_save_subscription_product_v1(viewer,p.code,p.revision+1,p.name,99,'','draft');
   raise exception 'Viewer save accepted';
 exception when insufficient_privilege then null; end;
 begin
   perform public.admin_save_subscription_product_v1(actor,p.code,p.revision+1,p.name,null,'','ready');
   raise exception 'Ready without price accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.admin_save_subscription_product_v1(actor,p.code,p.revision+1,p.name,1.001,'','draft');
   raise exception 'Fractional paise accepted';
 exception when invalid_parameter_value then null; end;
 if has_table_privilege('authenticated','public.admin_subscription_products','select') or
 has_function_privilege('authenticated','public.admin_save_subscription_product_v1(uuid,text,integer,text,numeric,text,text)','execute') or
 has_function_privilege('anon','public.admin_save_subscription_product_v1(uuid,text,integer,text,numeric,text,text)','execute') then raise exception 'Client privileges exposed'; end if;
 raise exception 'QA_ROLLBACK_SUCCESS';
 exception when raise_exception then
   if sqlerrm <> 'QA_ROLLBACK_SUCCESS' then raise; end if;
 end;
end $$;
select count(*)=7 as seven_products, bool_and(price_inr is null and status='draft' and revision=1) as seed_preserved from public.admin_subscription_products;
