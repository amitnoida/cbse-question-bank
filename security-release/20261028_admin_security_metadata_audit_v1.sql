-- Security audit metadata: read-only, SECURITY INVOKER and service-role-only.
-- Used exclusively by the server-protected Full Admin Reports & Database Audit API.
-- No existing function, RLS policy, table data, or user privilege is modified.
CREATE OR REPLACE FUNCTION public.cbse_admin_security_audit_v1(p_kind text)
RETURNS TABLE(entry jsonb)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $audit$
  SELECT pg_catalog.jsonb_build_object(
    'object_type', 'Function',
    'schema', n.nspname,
    'name', p.proname,
    'signature', pg_catalog.pg_get_function_identity_arguments(p.oid),
    'security_definer', p.prosecdef,
    'volatility', CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END,
    'search_path', COALESCE(pg_catalog.array_to_string(p.proconfig, ', '), '(role default)'),
    'public_execute', EXISTS(
      SELECT 1 FROM pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) AS acl WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    ),
    'anon_execute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'detail', CASE
      WHEN p.prosecdef AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        THEN 'REVIEW: SECURITY DEFINER callable by anon'
      WHEN p.prosecdef AND pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        THEN 'REVIEW: SECURITY DEFINER callable by authenticated'
      WHEN p.prosecdef THEN 'SECURITY DEFINER; restricted execute'
      ELSE 'SECURITY INVOKER'
    END
  ) AS entry
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE p_kind = 'function-audit'
    AND n.nspname = 'public'

  UNION ALL

  SELECT pg_catalog.jsonb_build_object(
    'object_type', 'Table RLS',
    'schema', n.nspname,
    'name', c.relname,
    'signature', NULL,
    'security_definer', NULL,
    'volatility', NULL,
    'search_path', NULL,
    'public_execute', NULL,
    'anon_execute', NULL,
    'authenticated_execute', NULL,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity,
    'policy_count', (
      SELECT count(*) FROM pg_catalog.pg_policies pol
      WHERE pol.schemaname = n.nspname AND pol.tablename = c.relname
    ),
    'detail', CASE
      WHEN NOT c.relrowsecurity THEN 'REVIEW: RLS DISABLED'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies pol
        WHERE pol.schemaname=n.nspname AND pol.tablename=c.relname
      ) THEN 'RLS enabled; no policies (default deny)'
      ELSE 'RLS enabled'
    END
  ) AS entry
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE p_kind = 'function-audit'
    AND n.nspname = 'public'
    AND c.relkind IN ('r', 'p')

  UNION ALL

  SELECT pg_catalog.jsonb_build_object(
    'schema', pol.schemaname,
    'table', pol.tablename,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity,
    'policy', pol.policyname,
    'permissive', pol.permissive,
    'command', pol.cmd,
    'roles', pg_catalog.array_to_string(pol.roles, ', '),
    'using_expression', pol.qual,
    'check_expression', pol.with_check
  ) AS entry
  FROM pg_catalog.pg_policies pol
  JOIN pg_catalog.pg_namespace n ON n.nspname = pol.schemaname
  JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=pol.tablename
  WHERE p_kind = 'rls-policies'
    AND pol.schemaname = 'public'
    AND c.relkind IN ('r', 'p');
$audit$;

-- New PostgreSQL functions are executable by PUBLIC by default. Revoke it
-- together with any Supabase default direct grants, before enabling API access.
REVOKE ALL ON FUNCTION public.cbse_admin_security_audit_v1(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cbse_admin_security_audit_v1(text)
  TO service_role;
COMMENT ON FUNCTION public.cbse_admin_security_audit_v1(text) IS
  'Full Admin-only security catalog audit via authenticated Next.js server; no application client EXECUTE.';
