-- CBSE ADMIN UPGRADE - corrected migration candidate (2026-10-11)
-- IMPORTANT: REVIEW / STAGING FIRST. Do not execute against production until
-- the API and existing RPC access checks have been security-tested.
-- No existing student/admin rows are deleted by this migration.
BEGIN;

-- Stop rather than silently modifying an unexpected schema.
DO $$ BEGIN
 IF to_regclass('public.admin_users') IS NULL OR
    to_regclass('public.admin_profiles') IS NULL OR
    to_regclass('public.student_profiles') IS NULL THEN
   RAISE EXCEPTION 'Expected admin/student tables are missing. Migration stopped.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_profiles' AND column_name='id') OR
    NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_profiles' AND column_name='is_active') THEN
   RAISE EXCEPTION 'Unexpected admin_profiles schema. Migration stopped.';
 END IF;
END $$;

ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'FULL_ADMIN';
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.admin_profiles DROP CONSTRAINT IF EXISTS admin_profiles_role_check;
ALTER TABLE public.admin_profiles ADD CONSTRAINT admin_profiles_role_check CHECK (role IN ('FULL_ADMIN','ADMIN_VIEW'));
-- Existing admins retain FULL_ADMIN by default; do not reset previously assigned roles.
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Students must not be able to change their own suspension status through the
-- existing student_profiles UPDATE policy. The service-role backend may do so.
CREATE OR REPLACE FUNCTION public.cbse_guard_student_active_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NEW.is_active IS DISTINCT FROM OLD.is_active AND auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Only the account-management service can change account status' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cbse_guard_student_active_status_trigger ON public.student_profiles;
CREATE TRIGGER cbse_guard_student_active_status_trigger
BEFORE UPDATE ON public.student_profiles FOR EACH ROW
EXECUTE FUNCTION public.cbse_guard_student_active_status();
REVOKE ALL ON FUNCTION public.cbse_guard_student_active_status() FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.site_announcements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 400),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT site_announcements_time_check CHECK (ends_at > starts_at)
);
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcement_public_active ON public.site_announcements;
CREATE POLICY announcement_public_active ON public.site_announcements
FOR SELECT TO anon,authenticated
USING (enabled IS TRUE AND starts_at <= now() AND ends_at > now());
REVOKE ALL ON public.site_announcements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.site_announcements TO anon,authenticated;

-- Called ONLY from server-side API using the service-role client.
CREATE OR REPLACE FUNCTION public.admin_upgrade_student_list(p_actor uuid)
RETURNS TABLE(student_id uuid,student_name text,email text,email_verified boolean,created_at timestamptz,is_active boolean,delete_eligible boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Service role only' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.admin_users au
   JOIN public.admin_profiles ap ON ap.id=au.user_id
   WHERE au.user_id=p_actor AND ap.is_active IS TRUE AND ap.must_change_password IS FALSE
 ) THEN
   RAISE EXCEPTION 'Not an active administrator' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT u.id,sp.full_name,u.email::text,
        (u.email_confirmed_at IS NOT NULL),u.created_at,
        coalesce(sp.is_active,true),
        (u.email_confirmed_at IS NULL AND u.created_at<=now()-interval '48 hours')
 FROM auth.users u
 LEFT JOIN public.student_profiles sp ON sp.id=u.id
 WHERE NOT EXISTS(SELECT 1 FROM public.admin_users au WHERE au.user_id=u.id)
 ORDER BY u.created_at DESC LIMIT 2000;
END $$;
REVOKE ALL ON FUNCTION public.admin_upgrade_student_list(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upgrade_student_list(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_full_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.admin_users au
   JOIN public.admin_profiles ap ON ap.id=au.user_id
   WHERE au.user_id=auth.uid() AND ap.is_active IS TRUE
     AND ap.role='FULL_ADMIN' AND ap.must_change_password IS FALSE
 );
$$;
REVOKE ALL ON FUNCTION public.is_full_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_full_admin() TO authenticated,service_role;

-- Preserve original coupon logic and signatures, but enforce role checks at
-- the original RPC entry points. The renamed implementations are inaccessible
-- to authenticated/anon clients, including via direct RPC calls.
DO $$ BEGIN
 IF to_regprocedure('public.admin_coupon_create(integer,integer)') IS NULL AND to_regprocedure('public.admin_coupon_create_legacy(integer,integer)') IS NULL THEN
   RAISE EXCEPTION 'admin_coupon_create missing';
 END IF;
 IF to_regprocedure('public.admin_coupon_set_active(bigint,boolean)') IS NULL AND to_regprocedure('public.admin_coupon_set_active_legacy(bigint,boolean)') IS NULL THEN
   RAISE EXCEPTION 'admin_coupon_set_active missing';
 END IF;
 IF to_regprocedure('public.generate_admin_coupon(text)') IS NULL AND to_regprocedure('public.generate_admin_coupon_legacy(text)') IS NULL THEN
   RAISE EXCEPTION 'generate_admin_coupon missing';
 END IF;
 IF to_regprocedure('public.admin_coupon_create_legacy(integer,integer)') IS NULL THEN
   ALTER FUNCTION public.admin_coupon_create(integer,integer) RENAME TO admin_coupon_create_legacy;
 END IF;
 IF to_regprocedure('public.admin_coupon_set_active_legacy(bigint,boolean)') IS NULL THEN
   ALTER FUNCTION public.admin_coupon_set_active(bigint,boolean) RENAME TO admin_coupon_set_active_legacy;
 END IF;
 IF to_regprocedure('public.generate_admin_coupon_legacy(text)') IS NULL THEN
   ALTER FUNCTION public.generate_admin_coupon(text) RENAME TO generate_admin_coupon_legacy;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_coupon_create(p_discount integer,p_valid_days integer DEFAULT 30)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_full_admin() THEN RAISE EXCEPTION 'Full Admin only' USING ERRCODE='42501'; END IF;
 RETURN public.admin_coupon_create_legacy(p_discount,p_valid_days);
END $$;
CREATE OR REPLACE FUNCTION public.admin_coupon_set_active(p_coupon_id bigint,p_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_full_admin() THEN RAISE EXCEPTION 'Full Admin only' USING ERRCODE='42501'; END IF;
 RETURN public.admin_coupon_set_active_legacy(p_coupon_id,p_active);
END $$;
CREATE OR REPLACE FUNCTION public.generate_admin_coupon(p_plan_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_full_admin() THEN RAISE EXCEPTION 'Full Admin only' USING ERRCODE='42501'; END IF;
 RETURN public.generate_admin_coupon_legacy(p_plan_code);
END $$;
REVOKE ALL ON FUNCTION public.admin_coupon_create_legacy(integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_coupon_set_active_legacy(bigint,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.generate_admin_coupon_legacy(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_coupon_create(integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_coupon_set_active(bigint,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.generate_admin_coupon(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_coupon_create(integer,integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_coupon_set_active(bigint,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.generate_admin_coupon(text) TO authenticated,service_role;
COMMIT;

-- IMPORTANT OUTSTANDING APP WORK (not solved by this migration):
-- 1. Server API must block password changes of another user and restrict
--    password changes to a validated current user/session.
-- 2. Existing admin read RPCs must enforce must_change_password, and every
--    other admin write RPC must enforce FULL_ADMIN.
-- 3. Deactivated students must be denied access in application/quiz RPCs;
--    changing student_profiles.is_active alone does NOT block logins.
-- 4. Test invitation email rollback, existing coupon flows, and deletion
--    of unverified accounts against a staging clone before production.
