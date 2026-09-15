-- Synthetic fixtures only. Runs in an isolated throwaway database.
CREATE FUNCTION pg_temp.id(label text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5(label)::uuid $$;
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN RAISE EXCEPTION 'Expected %, got %: % (SQL: %)', expected_state, SQLSTATE, SQLERRM, statement; END IF;
    failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Expected failure: %', statement; END IF;
END $$;

INSERT INTO auth.users SELECT pg_temp.id(x) FROM unnest(ARRAY['f1','f2','coach','doctor','admin','inactive','unmapped']) x;
INSERT INTO public.users(id,auth_user_id,email,role,is_active) VALUES
  (pg_temp.id('u-f1'),pg_temp.id('f1'),'f1@example.invalid','FIGHTER',true),
  (pg_temp.id('u-f2'),pg_temp.id('f2'),'f2@example.invalid','FIGHTER',true),
  (pg_temp.id('u-coach'),pg_temp.id('coach'),'coach@example.invalid','COACH',true),
  (pg_temp.id('u-doctor'),pg_temp.id('doctor'),'doctor@example.invalid','DOCTOR',true),
  (pg_temp.id('u-admin'),pg_temp.id('admin'),'admin@example.invalid','ADMIN',true),
  (pg_temp.id('u-inactive'),pg_temp.id('inactive'),'inactive@example.invalid','COACH',false);
INSERT INTO fighters(id,user_id,first_name,last_name,date_of_birth,weight_class) VALUES
  (pg_temp.id('fighter1'),pg_temp.id('u-f1'),'Test','One','2000-01-01','LIGHTWEIGHT'),
  (pg_temp.id('fighter2'),pg_temp.id('u-f2'),'Test','Two','2000-01-01','WELTERWEIGHT');
INSERT INTO coaches(id,user_id,first_name,last_name) VALUES (pg_temp.id('c1'),pg_temp.id('u-coach'),'Test','Coach');
INSERT INTO sports_doctors(id,user_id,first_name,last_name,license_number) VALUES (pg_temp.id('d1'),pg_temp.id('u-doctor'),'Test','Doctor','TEST-LICENSE');
SELECT pg_temp.expect_error($q$INSERT INTO coaches(user_id,first_name,last_name) VALUES(pg_temp.id('u-f1'),'Wrong','Role')$q$,'23503');
SELECT pg_temp.expect_error($q$UPDATE users SET email='UPPER@example.invalid' WHERE id=pg_temp.id('u-f1')$q$,'23514');
SELECT pg_temp.expect_error($q$UPDATE users SET role='ADMIN' WHERE id=pg_temp.id('u-f1')$q$,'23503');

INSERT INTO coach_fighters(coach_id,fighter_id,assigned_by_id,starts_at) VALUES(pg_temp.id('c1'),pg_temp.id('fighter1'),pg_temp.id('u-admin'),'2026-01-01');
SELECT pg_temp.expect_error($q$INSERT INTO coach_fighters(coach_id,fighter_id,assigned_by_id) VALUES(pg_temp.id('c1'),pg_temp.id('fighter1'),pg_temp.id('u-admin'))$q$,'23505');
UPDATE coach_fighters SET ends_at='2026-02-01',ended_by_id=pg_temp.id('u-admin'),end_reason='Reassignment';
INSERT INTO coach_fighters(coach_id,fighter_id,assigned_by_id,starts_at) VALUES(pg_temp.id('c1'),pg_temp.id('fighter1'),pg_temp.id('u-admin'),'2026-03-01');
SELECT pg_temp.expect_error($q$UPDATE coach_fighters SET ends_at=NULL, ended_by_id=NULL,end_reason=NULL WHERE ends_at IS NOT NULL$q$,'23514');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM coach_fighters),'assignment episodes retained');

INSERT INTO training_plans(id,fighter_id,coach_id,title,start_date) VALUES(pg_temp.id('plan1'),pg_temp.id('fighter1'),pg_temp.id('c1'),'Plan','2026-01-01');
INSERT INTO training_sessions(id,fighter_id,plan_id,title,scheduled_at,session_type) VALUES
  (pg_temp.id('s1'),pg_temp.id('fighter1'),pg_temp.id('plan1'),'S1','2026-01-02','SHADOW_BOXING'),
  (pg_temp.id('s2'),pg_temp.id('fighter2'),NULL,'S2','2026-01-02','PAD_WORK');
SELECT pg_temp.expect_error($q$INSERT INTO training_sessions(fighter_id,plan_id,title,scheduled_at,session_type) VALUES(pg_temp.id('fighter2'),pg_temp.id('plan1'),'Wrong',now(),'PAD_WORK')$q$,'23503');
SELECT pg_temp.expect_error($q$UPDATE training_sessions SET status='COMPLETED' WHERE id=pg_temp.id('s1')$q$,'23514');
INSERT INTO session_rounds(id,session_id,round_number) VALUES(pg_temp.id('r1'),pg_temp.id('s1'),1),(pg_temp.id('r2'),pg_temp.id('s2'),1);
INSERT INTO exercises(id,name,category) VALUES(pg_temp.id('exercise1'),'Jab practice','STRIKING');
INSERT INTO training_plan_exercises(plan_id,exercise_id,order_index) VALUES(pg_temp.id('plan1'),pg_temp.id('exercise1'),0);
INSERT INTO session_exercises(session_id,exercise_id,order_index,exercise_name_snapshot) VALUES(pg_temp.id('s1'),pg_temp.id('exercise1'),0,'Jab practice');
SELECT pg_temp.expect_error($q$INSERT INTO session_exercises(session_id,exercise_id,order_index,exercise_name_snapshot) VALUES(pg_temp.id('s1'),pg_temp.id('exercise1'),0,'Jab practice')$q$,'23505');

-- Parameters are arbitrary synthetic values used to exercise DDL only.
INSERT INTO algorithm_configs(id,version_tag,yolo_model_name,conf_threshold,ema_alpha,jerk_smooth_threshold,rom_low_threshold,rom_recovery_threshold,consecutive_low_rom_limit,window_sec_min,window_sec_max,disuse_sec_trigger,is_active,activated_at)
VALUES(pg_temp.id('config1'),'test-only','test-only',0.5,0.5,1,0.5,1,1,1,2,1,true,now());
SELECT pg_temp.expect_error($q$UPDATE algorithm_configs SET ema_alpha=0.7 WHERE id=pg_temp.id('config1')$q$,'23514');
INSERT INTO videos(id,subject_fighter_id,uploaded_by_id,session_id,title,storage_provider,storage_bucket,storage_key,file_size_bytes,mime_type,duration_ms) VALUES
  (pg_temp.id('v1'),pg_temp.id('fighter1'),pg_temp.id('u-f1'),pg_temp.id('s1'),'Upload 1','test','videos','one',10,'video/mp4',60000),
  (pg_temp.id('v2'),pg_temp.id('fighter1'),pg_temp.id('u-f1'),pg_temp.id('s1'),'Upload 2','test','videos','two',10,'video/mp4',60000);
INSERT INTO analysis_jobs(id,video_url,video_id) VALUES(pg_temp.id('j1'),'https://example.invalid/1',pg_temp.id('v1')),(pg_temp.id('j2'),'https://example.invalid/2',pg_temp.id('v2'));
INSERT INTO ai_analyses(id,job_id,video_id,fighter_id,session_id,algorithm_config_id) VALUES
  (pg_temp.id('a1'),pg_temp.id('j1'),pg_temp.id('v1'),pg_temp.id('fighter1'),pg_temp.id('s1'),pg_temp.id('config1')),
  (pg_temp.id('a2'),pg_temp.id('j2'),pg_temp.id('v2'),pg_temp.id('fighter1'),pg_temp.id('s1'),pg_temp.id('config1'));
SELECT pg_temp.expect_error($q$INSERT INTO analysis_jobs(video_url,video_id) VALUES('https://example.invalid/duplicate',pg_temp.id('v1'))$q$,'23505');
SELECT pg_temp.expect_error($q$INSERT INTO ai_analyses(job_id,video_id,fighter_id,session_id,algorithm_config_id) VALUES(pg_temp.id('j2'),pg_temp.id('v1'),pg_temp.id('fighter1'),pg_temp.id('s1'),pg_temp.id('config1'))$q$,'23514');
SELECT pg_temp.expect_error($q$UPDATE analysis_jobs SET fighter_id=pg_temp.id('fighter2') WHERE id=pg_temp.id('j1')$q$,'23514');
SELECT pg_temp.expect_error($q$UPDATE videos SET session_id=NULL WHERE id=pg_temp.id('v1')$q$,'23514');
INSERT INTO video_round_segments(video_id,round_id,session_id,start_time_ms,end_time_ms) VALUES(pg_temp.id('v1'),pg_temp.id('r1'),pg_temp.id('s1'),0,30000);
SELECT pg_temp.expect_error($q$INSERT INTO video_round_segments(video_id,round_id,session_id,start_time_ms,end_time_ms) VALUES(pg_temp.id('v2'),pg_temp.id('r2'),pg_temp.id('s1'),0,30000)$q$,'23503');
INSERT INTO session_summaries(session_id,fighter_id,analysis_id,algorithm_config_id) VALUES
  (pg_temp.id('s1'),pg_temp.id('fighter1'),pg_temp.id('a1'),pg_temp.id('config1')),
  (pg_temp.id('s1'),pg_temp.id('fighter1'),pg_temp.id('a2'),pg_temp.id('config1'));
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM session_summaries),'separate summaries per upload in one session');
SELECT pg_temp.expect_error($q$UPDATE session_summaries SET total_strikes=-1$q$,'23514');
INSERT INTO coach_reviews(id,analysis_id,coach_id,review_text,revision) VALUES(pg_temp.id('review1'),pg_temp.id('a1'),pg_temp.id('c1'),'Initial',1);
INSERT INTO coach_reviews(analysis_id,coach_id,review_text,revision,supersedes_id) VALUES(pg_temp.id('a1'),pg_temp.id('c1'),'Correction',2,pg_temp.id('review1'));
SELECT pg_temp.expect_error($q$UPDATE coach_reviews SET review_text='overwrite'$q$,'23514');

INSERT INTO fighter_measurements(id,fighter_id,recorded_by_id,measured_at,measurement_context,weight_kg,height_cm,reach_cm) VALUES
  (pg_temp.id('m1'),pg_temp.id('fighter1'),pg_temp.id('u-doctor'),'2026-01-01','CHECKUP',70.25,175.0,180.0),
  (pg_temp.id('m2'),pg_temp.id('fighter2'),pg_temp.id('u-doctor'),'2026-01-01','WEIGH_IN',77.0,180.0,183.0);
SELECT pg_temp.expect_error($q$INSERT INTO fighter_measurements(fighter_id,recorded_by_id,measured_at,measurement_context,weight_kg) VALUES(pg_temp.id('fighter1'),pg_temp.id('u-doctor'),now(),'WEIGH_IN',-1)$q$,'23514');
SELECT pg_temp.expect_error($q$INSERT INTO fighter_measurements(fighter_id,recorded_by_id,measured_at,measurement_context,weight_kg) VALUES(pg_temp.id('fighter1'),pg_temp.id('u-doctor'),now(),'WEIGH_IN','NaN')$q$,'23514');
SELECT pg_temp.expect_error($q$UPDATE fighter_measurements SET weight_kg=71$q$,'23514');
SELECT pg_temp.expect_error($q$INSERT INTO fighter_measurements(fighter_id,recorded_by_id,measured_at,measurement_context,weight_kg,supersedes_id) VALUES(pg_temp.id('fighter2'),pg_temp.id('u-doctor'),now(),'CHECKUP',77,pg_temp.id('m1'))$q$,'23503');

INSERT INTO injury_records(id,fighter_id,reported_by_id,affected_joint,injury_type,severity,occurred_at) VALUES
  (pg_temp.id('injury1'),pg_temp.id('fighter1'),pg_temp.id('d1'),'LEFT_KNEE','Synthetic fixture','MINOR','2026-01-01'),
  (pg_temp.id('injury2'),pg_temp.id('fighter2'),pg_temp.id('d1'),'RIGHT_KNEE','Synthetic fixture','MINOR','2026-01-01');
INSERT INTO treatments(injury_id,doctor_id,treatment_date,treatment_type) SELECT id,pg_temp.id('d1'),'2026-01-02','Synthetic fixture' FROM injury_records;
INSERT INTO medical_clearances(fighter_id,issued_by_id,clearance_type,valid_from) SELECT id,pg_temp.id('d1'),'TRAINING','2026-01-01' FROM fighters;
INSERT INTO recovery_plans(fighter_id,injury_id,doctor_id,title,start_date) SELECT fighter_id,id,pg_temp.id('d1'),'Synthetic fixture','2026-01-02' FROM injury_records;
SELECT pg_temp.expect_error($q$INSERT INTO recovery_plans(fighter_id,injury_id,doctor_id,title,start_date) VALUES(pg_temp.id('fighter2'),pg_temp.id('injury1'),pg_temp.id('d1'),'Wrong fighter','2026-01-02')$q$,'23503');
SELECT pg_temp.expect_error($q$UPDATE medical_clearances SET status='REVOKED'$q$,'23514');
SELECT pg_temp.expect_error($q$UPDATE audit_logs SET action='tampered'$q$,'23514');
SELECT pg_temp.expect_error($q$DELETE FROM audit_logs$q$,'23514');
SELECT pg_temp.expect_error($q$TRUNCATE audit_logs$q$,'23514');
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM audit_logs WHERE resource_type='fighter_measurements'),'medical mutations audited');
SELECT pg_temp.assert_true((SELECT bool_and(NOT details ? 'weight_kg') FROM audit_logs),'audit excludes clinical values');

-- Exercise real PostgreSQL privileges/RLS under Supabase-like auth claims.
SET ROLE authenticated;
-- Baseline grants deliberately remain unchanged: legacy inserts cannot require new domain privileges.
INSERT INTO analysis_jobs(video_url) VALUES ('https://example.invalid/legacy-authenticated');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('f1')::text,false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM fighter_measurements),'fighter sees own measurement');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM injury_records),'fighter sees own injury');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM treatments),'fighter sees own treatment via injury');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM medical_clearances),'fighter sees own clearance');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM recovery_plans),'fighter sees own recovery');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM audit_logs),'fighter cannot read audit');
SELECT pg_temp.expect_error($q$UPDATE users SET role='ADMIN' WHERE auth_user_id=auth.uid()$q$,'42501');
SELECT pg_temp.expect_error($q$UPDATE fighter_measurements SET weight_kg=71$q$,'42501');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('f2')::text,false);
SELECT pg_temp.assert_true((SELECT bool_and(fighter_id=pg_temp.id('fighter2')) FROM fighter_measurements),'fighter two cannot cross-read');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('coach')::text,false);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM fighter_measurements),'coach reads ALL fighters without assignment restriction');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM treatments),'coach reads all treatments');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM audit_logs),'coach cannot read audit');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('doctor')::text,false);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM fighter_measurements),'doctor reads ALL fighters without assignments');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM audit_logs),'doctor cannot read audit');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('admin')::text,false);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM fighter_measurements),'admin reads all medical');
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM audit_logs),'admin reads audit');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('inactive')::text,false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM fighter_measurements),'inactive account denied');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('unmapped')::text,false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM fighter_measurements),'unmapped auth identity denied');
SELECT set_config('request.jwt.claim.sub','',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM fighter_measurements),'missing subject denied');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM fighter_measurements','42501');
SELECT pg_temp.expect_error('SELECT * FROM users','42501');
RESET ROLE;
