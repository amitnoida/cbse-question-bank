-- ExamYari release: only NEW coupons default to full 13-month membership.
-- Apply during controlled release after preview/rollback QA.
-- Historical coupons and existing subscriptions must remain unchanged.
-- ONE_YEAR is a historical enum name; the live cbse_membership.quote()
-- function currently calculates 13 calendar months for this value.
BEGIN;
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.coupons'::regclass
      AND pg_get_constraintdef(oid) LIKE '%ONE_YEAR%'
  ) THEN
    RAISE EXCEPTION 'Coupon validity constraint not verified; do not migrate';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='cbse_membership' AND p.proname='quote'
      AND pg_get_functiondef(p.oid) LIKE '%13 months%'
  ) THEN
    RAISE EXCEPTION 'Membership quote does not explicitly grant 13 months';
  END IF;
END $guard$;
ALTER TABLE public.coupons
 ALTER COLUMN membership_validity SET DEFAULT 'ONE_YEAR';
COMMIT;

-- Verify: new coupon default is ONE_YEAR, and existing coupon validity
-- and existing subscription end_date values were not rewritten.
SELECT column_default
FROM information_schema.columns
WHERE table_schema='public'
 AND table_name='coupons'
 AND column_name='membership_validity';
