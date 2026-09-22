-- MMA-TMS 010: thu hẹp quyền đọc trực tiếp dữ liệu clinical theo chủ thể và phân công Doctor.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260920, 10);

DO $preflight$
DECLARE
  missing_tables TEXT[];
  missing_policies TEXT[];
BEGIN
  IF to_regclass('mma_private.migration_history') IS NULL
     OR to_regprocedure('mma_private.can_read_fighter_medical(uuid)') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION '010 requires migration 003 and Supabase auth helpers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 9
  ) THEN
    RAISE EXCEPTION '010 requires migration 009 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 10
  ) THEN
    RAISE EXCEPTION '010 has already been applied';
  END IF;

  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO missing_tables
  FROM (
    SELECT unnest(ARRAY[
      'medical_clearances',
      'injury_records',
      'treatments',
      'recovery_plans',
      'fighter_measurements',
      'health_alerts',
      'fighter_joint_states',
      'joint_health_history',
      'fighter_baselines'
    ]::TEXT[]) AS table_name
  ) AS required
  LEFT JOIN pg_catalog.pg_class AS relation
    ON relation.oid = to_regclass('public.' || required.table_name)
   AND relation.relkind = 'r'
   AND relation.relrowsecurity
  WHERE relation.oid IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION '010 requires RLS-enabled clinical tables: %', missing_tables;
  END IF;

  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO missing_policies
  FROM (
    SELECT unnest(ARRAY[
      'medical_clearances',
      'injury_records',
      'treatments',
      'recovery_plans',
      'fighter_measurements',
      'health_alerts',
      'fighter_joint_states',
      'joint_health_history',
      'fighter_baselines'
    ]::TEXT[]) AS table_name
  ) AS required
  LEFT JOIN pg_catalog.pg_policies AS policy
    ON policy.schemaname = 'public'
   AND policy.tablename = required.table_name
   AND policy.policyname = 'medical_read'
   AND policy.cmd = 'SELECT'
   AND policy.roles = ARRAY['authenticated']::name[]
  WHERE policy.policyname IS NULL;

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION '010 requires the existing authenticated medical_read policies: %', missing_policies;
  END IF;
END
$preflight$;

-- Hàm SECURITY DEFINER chỉ trả về quyết định scope; không trả dữ liệu clinical cho người gọi.
CREATE OR REPLACE FUNCTION mma_private.can_read_fighter_medical(target_fighter_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE((
    SELECT CASE
      WHEN actor.role = 'FIGHTER' THEN EXISTS (
        SELECT 1
        FROM public.fighters AS fighter
        WHERE fighter.id = target_fighter_id
          AND fighter.user_id = actor.id
          AND fighter.is_active
          AND fighter.deleted_at IS NULL
      )
      WHEN actor.role = 'DOCTOR' THEN EXISTS (
        SELECT 1
        FROM public.sports_doctors AS doctor
        JOIN public.doctor_fighters AS assignment
          ON assignment.doctor_id = doctor.id
        JOIN public.fighters AS fighter
          ON fighter.id = assignment.fighter_id
        JOIN public.users AS fighter_user
          ON fighter_user.id = fighter.user_id
        WHERE doctor.user_id = actor.id
          AND doctor.is_active
          AND doctor.deleted_at IS NULL
          AND assignment.fighter_id = target_fighter_id
          AND assignment.starts_at <= now()
          AND (assignment.ends_at IS NULL OR assignment.ends_at > now())
          AND fighter.is_active
          AND fighter.deleted_at IS NULL
          AND fighter_user.is_active
          AND fighter_user.deleted_at IS NULL
      )
      ELSE FALSE
    END
    FROM public.users AS actor
    WHERE actor.auth_user_id = (SELECT auth.uid())
      AND actor.is_active
      AND actor.deleted_at IS NULL
  ), FALSE)
$function$;

-- Chỉ authenticated được đánh giá policy; anonymous và PUBLIC không được gọi helper.
REVOKE ALL ON FUNCTION mma_private.can_read_fighter_medical(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mma_private.can_read_fighter_medical(UUID) TO authenticated;

COMMENT ON FUNCTION mma_private.can_read_fighter_medical(UUID) IS
  'Cho phép Fighter đọc dữ liệu của mình và Doctor đọc dữ liệu của Fighter đang được phân công; Coach và Admin luôn bị từ chối.';

-- Không FORCE RLS để kết nối backend/service-role có BYPASSRLS tiếp tục xử lý nghiệp vụ đã xác thực.
REVOKE SELECT ON public.medical_clearances FROM PUBLIC, anon;
REVOKE SELECT ON public.injury_records FROM PUBLIC, anon;
REVOKE SELECT ON public.treatments FROM PUBLIC, anon;
REVOKE SELECT ON public.recovery_plans FROM PUBLIC, anon;
REVOKE SELECT ON public.fighter_measurements FROM PUBLIC, anon;
REVOKE SELECT ON public.health_alerts FROM PUBLIC, anon;
REVOKE SELECT ON public.fighter_joint_states FROM PUBLIC, anon;
REVOKE SELECT ON public.joint_health_history FROM PUBLIC, anon;
REVOKE SELECT ON public.fighter_baselines FROM PUBLIC, anon;

-- Runner đã xác minh sẽ cung cấp checksum nguồn; chạy tay trong SQL Editor sẽ lưu NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  10,
  '010_restrict_clinical_rls.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
