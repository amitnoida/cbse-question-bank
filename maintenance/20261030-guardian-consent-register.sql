-- Account consent verification record. Contains *metadata only*, never raw identity documents.
-- Must be deployed before the corresponding admin UI/API gate is enabled.
BEGIN;
CREATE TABLE IF NOT EXISTS public.guardian_account_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guardian_name text NOT NULL CHECK(length(btrim(guardian_name)) BETWEEN 2 AND 120),
 guardian_email text NOT NULL CHECK(length(guardian_email) BETWEEN 5 AND 254),
 verification_method text NOT NULL CHECK(verification_method IN ('DIGILOCKER','OFFLINE_GOVERNMENT_ID','RELIABLE_EXISTING_RECORD')),
 verification_reference text NOT NULL CHECK(length(btrim(verification_reference)) BETWEEN 8 AND 120),
 relationship_basis text NOT NULL CHECK(length(btrim(relationship_basis)) BETWEEN 8 AND 300),
 consent_evidence_reference text NOT NULL CHECK(length(btrim(consent_evidence_reference)) BETWEEN 8 AND 120),
 consent_notice_version text NOT NULL DEFAULT '2026-10-30',
 guardian_consented_at timestamptz NOT NULL,
 verified_by uuid NOT NULL REFERENCES auth.users(id),
 verified_at timestamptz NOT NULL DEFAULT now(),
 creation_request uuid UNIQUE,
 student_id uuid UNIQUE REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guardian_account_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_account_consents FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.guardian_account_consents TO service_role;
CREATE OR REPLACE FUNCTION public.cbse_guardian_claim_v1(p_admin uuid,p_consent uuid,p_request uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.guardian_account_consents;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.admin_profiles p WHERE p.id=p_admin AND p.role='FULL_ADMIN' AND p.is_active AND NOT p.must_change_password)
 THEN RAISE EXCEPTION 'Full Admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.guardian_account_consents WHERE id=p_consent FOR UPDATE;
 IF NOT FOUND OR c.verified_by IS NULL OR (c.student_id IS NOT NULL AND c.creation_request<>p_request) OR
    (c.creation_request IS NOT NULL AND c.creation_request<>p_request)
 THEN RAISE EXCEPTION 'Valid unused guardian consent is required' USING ERRCODE='22023'; END IF;
 UPDATE public.guardian_account_consents SET creation_request=p_request WHERE id=p_consent;
 RETURN TRUE;
END $$;
CREATE OR REPLACE FUNCTION public.cbse_guardian_finish_v1(p_admin uuid,p_consent uuid,p_request uuid,p_student uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.admin_profiles p WHERE p.id=p_admin AND p.role='FULL_ADMIN' AND p.is_active AND NOT p.must_change_password)
 THEN RAISE EXCEPTION 'Full Admin required' USING ERRCODE='42501'; END IF;
 UPDATE public.guardian_account_consents SET student_id=p_student
 WHERE id=p_consent AND creation_request=p_request AND (student_id IS NULL OR student_id=p_student);
 IF NOT FOUND THEN RAISE EXCEPTION 'Guardian consent link not verified' USING ERRCODE='22023'; END IF;
 RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION public.cbse_guardian_claim_v1(uuid,uuid,uuid),public.cbse_guardian_finish_v1(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cbse_guardian_claim_v1(uuid,uuid,uuid),public.cbse_guardian_finish_v1(uuid,uuid,uuid,uuid) TO service_role;
COMMIT;
