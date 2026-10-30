-- Guardian-first registration control for ExamYari (self-service student accounts only).
-- No government document scans stored. Full Admin verifies legal-adult identity and
-- affirmative guardian consent OFFLINE before generating any invitation.
-- Existing students are left unchanged. Admin-created student/teacher identities
-- created through trusted admin_student_request must ALSO provide guardian consent;
-- verified adult teacher accounts are exempt from this CHILD signup gate.
BEGIN;
CREATE TABLE IF NOT EXISTS public.guardian_consent_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 guardian_email text NOT NULL CHECK(length(guardian_email) BETWEEN 5 AND 254),
 verification_method text NOT NULL CHECK(verification_method IN ('DIGILOCKER_VERIFIED','GOVERNMENT_ID_CHECKED','EXISTING_TRUSTED_KYC')),
 verification_reference text NOT NULL CHECK(length(verification_reference) BETWEEN 8 AND 180),
 statement_version text NOT NULL DEFAULT '2026-10-30-guardian-v1',
 consent_captured_at timestamptz NOT NULL,
 issued_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 used_at timestamptz,
 used_by uuid,
 revoked_at timestamptz,
 CONSTRAINT consent_token_single_use CHECK ((used_at IS NULL)=(used_by IS NULL))
);
ALTER TABLE public.guardian_consent_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_consent_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.guardian_consent_invitations TO service_role;
CREATE INDEX IF NOT EXISTS guardian_consent_expiration_idx ON public.guardian_consent_invitations(expires_at) WHERE used_at IS NULL;
CREATE OR REPLACE FUNCTION public.require_student_guardian_invitation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
DECLARE raw_code text; code_hash text; invitation_id uuid;
BEGIN
 -- Teachers created by the trusted Full Admin provisioning endpoint are adults
 -- and are outside child account registration. Student admin creation IS gated.
 -- raw_app_meta_data cannot be provided by a public signup request.
 IF coalesce(NEW.raw_app_meta_data,'{}'::jsonb)->>'admin_student_role'='TEACHER'\n AND coalesce(NEW.raw_app_meta_data,'{}'::jsonb) ? 'admin_student_request' THEN RETURN NEW; END IF;
 -- Enforce on ALL ordinary Auth registrations; missing class metadata is not an escape.
 IF nullif(btrim(coalesce(NEW.raw_user_meta_data->>'class_id','')),'') IS NULL
   THEN RAISE EXCEPTION 'Student class and verified guardian invitation required' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.classes c WHERE c.id=(NEW.raw_user_meta_data->>'class_id')::bigint AND c.is_active
  AND c.class_number BETWEEN 8 AND 12
 ) THEN RAISE EXCEPTION 'An active school class is required' USING ERRCODE='23514'; END IF;
 raw_code:=coalesce(NEW.raw_user_meta_data->>'guardian_invitation','');
 IF length(raw_code)<32 OR length(raw_code)>128
   THEN RAISE EXCEPTION 'Valid verified guardian invitation required' USING ERRCODE='23514'; END IF;
 code_hash:=encode(sha256(convert_to(raw_code,'UTF8')),'hex');
 UPDATE public.guardian_consent_invitations
 SET used_at=now(),used_by=NEW.id
 WHERE token_hash=code_hash AND used_at IS NULL AND revoked_at IS NULL
 AND expires_at>now() AND consent_captured_at IS NOT NULL
 RETURNING id INTO invitation_id;
 IF invitation_id IS NULL
   THEN RAISE EXCEPTION 'Guardian invitation invalid, expired or already used' USING ERRCODE='23514'; END IF;
 -- Never retain the bearer token in auth user metadata.
 NEW.raw_user_meta_data:=coalesce(NEW.raw_user_meta_data,'{}'::jsonb)-'guardian_invitation';
 RETURN NEW;
END $guard$;
DROP TRIGGER IF EXISTS guardian_invitation_before_student_signup ON auth.users;
CREATE TRIGGER guardian_invitation_before_student_signup
BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.require_student_guardian_invitation_v1();
REVOKE ALL ON FUNCTION public.require_student_guardian_invitation_v1() FROM PUBLIC,anon,authenticated;
COMMIT;
