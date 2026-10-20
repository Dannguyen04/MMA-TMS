-- MMA-TMS 029: session (lesson plan) templates a coach can start a session from.
-- Read-only catalogue seeded with four system templates (Vietnamese and
-- English text). The API exposes it through GET /training-session-templates;
-- there is no write endpoint yet, so no audit trigger. Planned duration and
-- target RPE are proposals that a coach must review before the final demo.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-028.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 29);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '029 requires the migration 003 objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 28) THEN
    RAISE EXCEPTION '029 requires migration 028 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 29) THEN
    RAISE EXCEPTION '029 has already been applied';
  END IF;

  IF to_regtype('public.session_template_category') IS NOT NULL
     OR to_regclass('public.session_templates') IS NOT NULL THEN
    RAISE EXCEPTION '029 type or table collision';
  END IF;

  IF EXISTS (SELECT 1 FROM public.permissions WHERE code = 'training.session_template:read') THEN
    RAISE EXCEPTION '029 API permission catalogue collision';
  END IF;
END
$preflight$;

CREATE TYPE public.session_template_category AS ENUM ('TECHNIQUE', 'SPARRING', 'CONDITIONING', 'TACTICS');

CREATE TABLE public.session_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  category public.session_template_category NOT NULL,
  session_type public.session_type NOT NULL,
  planned_duration_min smallint NOT NULL,
  target_rpe smallint NOT NULL,
  translations jsonb NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_templates_code UNIQUE (code),
  CONSTRAINT ck_session_templates_code CHECK (code ~ '^[a-z][a-z0-9_-]{0,39}$'),
  CONSTRAINT ck_session_templates_duration CHECK (planned_duration_min BETWEEN 10 AND 300),
  CONSTRAINT ck_session_templates_rpe CHECK (target_rpe BETWEEN 1 AND 10),
  CONSTRAINT ck_session_templates_translations CHECK (COALESCE(
    jsonb_typeof(translations) = 'object'
    AND jsonb_typeof(translations -> 'vi') = 'object'
    AND jsonb_typeof(translations -> 'en') = 'object'
    AND jsonb_typeof(translations -> 'vi' -> 'steps') = 'array'
    AND jsonb_typeof(translations -> 'en' -> 'steps') = 'array'
    AND jsonb_array_length(translations -> 'vi' -> 'steps') BETWEEN 1 AND 10
    AND jsonb_array_length(translations -> 'en' -> 'steps') = jsonb_array_length(translations -> 'vi' -> 'steps')
  , false))
);

CREATE INDEX idx_session_templates_active_order
  ON public.session_templates (display_order, code) WHERE is_active;

CREATE TRIGGER trg_session_templates_updated_at BEFORE UPDATE
  ON public.session_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.session_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_templates FROM anon, authenticated;

INSERT INTO public.session_templates
  (code, category, session_type, planned_duration_min, target_rpe, display_order, translations)
VALUES
  ('distance', 'TECHNIQUE', 'PAD_WORK', 45, 5, 10, $j${
    "vi": {
      "name": "Jab – cross – thoát góc",
      "purpose": "Thoát khỏi đường phản công sau tổ hợp hai đòn.",
      "rationale": "Phù hợp điểm yếu đang theo dõi: còn đứng trong tầm đối thủ sau khi ra đòn.",
      "steps": [
        {"name": "Chuẩn bị", "detail": "HLV kiểm tra tư thế, thống nhất tín hiệu và đánh dấu vùng di chuyển."},
        {"name": "Bài tập chính", "detail": "Jab – cross trên đích, thoát góc theo tín hiệu; HLV quan sát vị trí kết thúc."},
        {"name": "Kiểm tra cuối buổi", "detail": "Ghi số lần đạt trên tổng số tình huống: thoát đúng vùng và giữ tư thế bảo vệ."}
      ]
    },
    "en": {
      "name": "Jab – cross – angle exit",
      "purpose": "Leave the counter-punch line after a two-punch combination.",
      "rationale": "Fits the weakness being tracked: still standing in the opponent's range after punching.",
      "steps": [
        {"name": "Preparation", "detail": "The coach checks posture, agrees on the signals and marks the movement zone."},
        {"name": "Main drill", "detail": "Jab – cross on the target, exit at an angle on the signal; the coach watches the finishing position."},
        {"name": "End-of-session check", "detail": "Record successes out of total situations: exited to the right zone and kept guard."}
      ]
    }
  }$j$::jsonb),
  ('counter', 'SPARRING', 'SPARRING', 45, 7, 20, $j${
    "vi": {
      "name": "Phòng thủ → phản đòn tình huống",
      "purpose": "Đưa kỹ năng phòng thủ vào tình huống có đối thủ.",
      "rationale": "Dùng khi HLV muốn kiểm tra khả năng chuyển kỹ thuật sang đối luyện; có tiếp xúc.",
      "steps": [
        {"name": "Thống nhất tình huống", "detail": "HLV quy định vai trò, tín hiệu dừng và phạm vi đối luyện."},
        {"name": "Đối luyện có kiểm soát", "detail": "Đối thủ đưa tín hiệu tấn công; võ sĩ chọn phương án phòng thủ và phản công."},
        {"name": "Đánh giá", "detail": "HLV ghi nhận chất lượng phòng thủ và vị trí sau phản công."}
      ]
    },
    "en": {
      "name": "Defence → situational counter",
      "purpose": "Bring defensive skills into situations with an opponent.",
      "rationale": "Use when the coach wants to check that technique carries over to live drilling; involves contact.",
      "steps": [
        {"name": "Agree the situations", "detail": "The coach sets the roles, the stop signal and the scope of the drill."},
        {"name": "Controlled drilling", "detail": "The partner gives an attack signal; the fighter picks a defence and counters."},
        {"name": "Assessment", "detail": "The coach records the quality of the defence and the position after the counter."}
      ]
    }
  }$j$::jsonb),
  ('strength', 'CONDITIONING', 'STRENGTH_CONDITIONING', 60, 6, 30, $j${
    "vi": {
      "name": "Sức mạnh thân trên",
      "purpose": "Theo dõi chất lượng vận động trong giáo án thể lực do HLV phụ trách.",
      "rationale": "Có tải thân trên; phải rà soát khi bác sĩ ghi hạn chế vùng này.",
      "steps": [
        {"name": "Kiểm tra trước buổi", "detail": "HLV xem trạng thái sức khỏe và kế hoạch thể lực đã thống nhất."},
        {"name": "Thực hiện giáo án", "detail": "HLV chọn bài và tải cụ thể tại buổi tập theo đánh giá chuyên môn."},
        {"name": "Ghi nhận", "detail": "Ghi mức hoàn thành, cảm nhận gắng sức và phản hồi khó chịu."}
      ]
    },
    "en": {
      "name": "Upper-body strength",
      "purpose": "Track movement quality in the conditioning plan the coach is responsible for.",
      "rationale": "Loads the upper body; review it when the doctor records a restriction for this area.",
      "steps": [
        {"name": "Pre-session check", "detail": "The coach reviews the fighter's health status and the agreed conditioning plan."},
        {"name": "Carry out the plan", "detail": "The coach picks the exercises and loads in the session based on professional judgement."},
        {"name": "Record", "detail": "Record completion, perceived effort and any discomfort reported."}
      ]
    }
  }$j$::jsonb),
  ('tactics', 'TACTICS', 'TACTICAL_ANALYSIS', 40, 2, 40, $j${
    "vi": {
      "name": "Đọc trận & phân tích đối thủ",
      "purpose": "Nhận diện tình huống và lựa chọn phương án trước khi thực hành.",
      "rationale": "Không có bài tập thể chất; có thể được HLV xem xét thay thế khi cần hạn chế vận động.",
      "steps": [
        {"name": "Xem tình huống", "detail": "Chọn các đoạn video có tình huống ra đòn và bị phản công."},
        {"name": "Phân tích lựa chọn", "detail": "Võ sĩ chỉ ra thời điểm và hướng thoát phù hợp, HLV phản biện."},
        {"name": "Kiểm tra hiểu bài", "detail": "Chấm số tình huống nhận diện đúng trên tổng tình huống đã xem."}
      ]
    },
    "en": {
      "name": "Fight reading & opponent analysis",
      "purpose": "Recognise situations and choose an option before practising.",
      "rationale": "No physical exercise; the coach can consider it as a substitute when movement has to be limited.",
      "steps": [
        {"name": "Watch situations", "detail": "Pick video clips showing a strike followed by a counter."},
        {"name": "Analyse the options", "detail": "The fighter points out the right timing and exit direction; the coach challenges the choice."},
        {"name": "Comprehension check", "detail": "Score the situations recognised correctly out of all situations watched."}
      ]
    }
  }$j$::jsonb);

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES (
  'training.session_template:read',
  'Read training session templates',
  'training_session_template',
  'read',
  'List the session (lesson plan) templates a coach can start a session from.'
);

INSERT INTO public.role_permissions (role, permission_id)
SELECT r.role::public.user_role, p.id
FROM public.permissions AS p
CROSS JOIN (VALUES ('COACH'), ('ADMIN')) AS r(role)
WHERE p.code = 'training.session_template:read';

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  29,
  '029_session_templates.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
