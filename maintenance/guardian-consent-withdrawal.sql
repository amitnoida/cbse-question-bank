-- Guardian withdrawal: suspend child learning access immediately while preserving
-- minimal audit/protected history pending verified erasure/retention decisions.
BEGIN;
ALTER TABLE public.guardian_consent_invitations
 ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
 ADD COLUMN IF NOT EXISTS withdrawal_evidence_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS guardian_one_unwithdrawn_consent_per_student ON public.guardian_consent_invitations(used_by) WHERE used_by IS NOT NULL AND withdrawn_at IS NULL;
CREATE OR REPLACE FUNCTION public.cbse_guardian_consent_withdraw_v1(p_actor uuid,p_invitation uuid,p_evidence text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE g public.guardian_consent_invitations;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_profiles ap JOIN public.admin_users au ON au.user_id=ap.id
  WHERE ap.id=p_actor AND ap.role='FULL_ADMIN' AND ap.is_active AND NOT ap.must_change_password)
 THEN RAISE EXCEPTION 'Full Admin required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 8 AND 180
 THEN RAISE EXCEPTION 'Record verified withdrawal request reference, without identity scans' USING ERRCODE='22023'; END IF;
 SELECT * INTO g FROM public.guardian_consent_invitations WHERE id=p_invitation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found' USING ERRCODE='22023'; END IF;
 IF g.withdrawn_at IS NOT NULL THEN RETURN jsonb_build_object('already_withdrawn',true,'student_id',g.used_by); END IF;
 UPDATE public.guardian_consent_invitations SET withdrawn_at=now(),revoked_at=now(),withdrawal_evidence_ref=btrim(p_evidence) WHERE id=p_invitation;
 IF g.used_by IS NOT NULL THEN
  UPDATE public.student_profiles SET is_active=false WHERE id=g.used_by;
  UPDATE public.student_device_sessions SET revoked_at=now(),revoke_reason='GUARDIAN_CONSENT_WITHDRAWN'
   WHERE student_id=g.used_by AND revoked_at IS NULL;
 END IF;
 RETURN jsonb_build_object('already_withdrawn',false,'student_id',g.used_by,'access_suspended',g.used_by IS NOT NULL);
END $fn$;
REVOKE ALL ON FUNCTION public.cbse_guardian_consent_withdraw_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cbse_guardian_consent_withdraw_v1(uuid,uuid,text) TO service_role;
COMMIT;
