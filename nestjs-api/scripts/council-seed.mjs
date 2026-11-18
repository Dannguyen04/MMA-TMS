#!/usr/bin/env node
// Bộ dữ liệu cho buổi hội đồng 19/11/2026: dọn dữ liệu thử và seed lại 12 võ sĩ của Lotus Combat.
// Chạy: node --env-file=.env scripts/council-seed.mjs            (chạy thử, ROLLBACK, không ghi gì)
//       node --env-file=.env scripts/council-seed.mjs --apply    (sao lưu JSON, tạo tài khoản auth, COMMIT)
// Ngày tham chiếu D = 2026-11-19 (giờ học viện UTC+7). Nhóm lên khoảng 15:00–18:00.
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const D = '2026-11-19';
const DEMO_CUTOFF = { off: 0, h: 14 }; // buổi tập trước 14:00 ngày D coi như đã xong

// ── thời gian ────────────────────────────────────────────────────────────────
const day = (o) => new Date(Date.parse(`${D}T00:00:00Z`) + o * 86_400_000).toISOString().slice(0, 10);
const at = (o, h, m = 0) => new Date(Date.parse(`${day(o)}T00:00:00Z`) + (h * 60 + m - 420) * 60_000).toISOString();
const plusMin = (iso, min) => new Date(Date.parse(iso) + min * 60_000).toISOString();
const isPast = (iso) => Date.parse(iso) < Date.parse(at(DEMO_CUTOFF.off, DEMO_CUTOFF.h));
const J = (x) => JSON.stringify(x);
const r1 = (n) => Math.round(n * 10) / 10;

// ── dữ liệu cố định đã có trên Supabase ──────────────────────────────────────
const VMMAF = '2b0a4dba-987b-4aa8-8b95-7ae6ab5ab50d';
const AIBA = 'c170a307-bce9-4627-a7e3-f6b0d2d8e049';
const KEEP_VIDEOS = {
  kenjiBag: '17edf203-62f9-43e5-a5ec-6e3e2d8aef17',
  minhBag20: 'a44345dc-cb53-4aa6-ab2b-14d9a85aa55c',
  minhBag25: '2167c835-095a-4c1f-be73-884355e7ffdb',
  minhShadow: '9ce13535-76f5-4c3b-8a40-28dee4710cdb',
};
const TEAMMATE_EMAILS = [
  'lenguyenhoanganh04@gmail.com', 'lenguyenhoanganh42@gmail.com', 'se182656nguyentiendat@gmail.com',
  'huynhdungphong2005+1@gmail.com', 'huynhdungphong2005+2@gmail.com', 'kenn0679@gmail.com', 'datntse182656@fpt.edu.vn',
];
const EX = {
  shadowFoot: '951a4d89-9323-478c-adb7-363044ef9822', jabCross: 'e3b0af7b-7e75-417e-82ba-4cd4a4ec8021',
  bag: '8d555685-9aa8-4df1-920d-1b773e7c2363', sprawl: '6fc72912-2429-44cd-8cd4-01b736608a86',
  doubleLeg: 'aa05d202-c7c8-49b5-a59e-3901e9c630a0', kb: '764ca653-4ba6-4a80-8100-03e7453fa7a8',
  mobility: 'b3a198da-13b4-4722-9c4b-2c284047ad5e', jchPads: 'ec8f3e8a-81c6-4c85-9503-3dc785c6da40',
  bagPower: '70310aac-69f1-4459-b29e-4479c6d3b88f', slipRoll: '452ae693-f1b2-4c3c-b0c8-2ad764a30810',
  cageCut: '31107956-58ba-444f-a5c0-54929a6a6e4f', sparring: 'f126558e-a35a-486e-9831-1e5dda965575',
  thaiPads: '2b61acee-f3b9-41b7-8707-a63a430524cc', chain: 'd146bf32-f2cc-4dde-ba53-040820716fe4',
  wallGetup: '2df375af-0029-4340-b80f-7f7166bab583', rope: '07c3bb23-33ed-4f86-bb5a-cba59d4a35c7',
  bike: '50353cb7-3efb-4be9-9186-318a76bd9b6d', deadlift: 'd81b917a-34ef-4002-882d-5f89f6f8a6f2',
  split: '8ad10d96-6dbe-4863-a5e0-df91d6dd58d9', nordic: '7aa15dff-c1d2-4c0b-989e-837f54c71089',
  neck: 'bbdba5f6-d652-49e3-9d58-1f907e553c3a', thoracic: '06991d35-e527-4cf9-8ab9-fc3383aa0c0a',
  hip9090: 'b8894df3-1d3a-4bc2-ab46-6d300d3e9a4f', shoulderCars: '5f5d5759-5151-4c7a-a1a8-e31009535683',
};

// ── 8 võ sĩ mới ─────────────────────────────────────────────────────────────
const NEW_FIGHTERS = [
  { key: 'bao', email: 'bao.tran@lotus-combat.test', first: 'Bảo', last: 'Trần', dob: '1999-03-14', wc: 'BANTAMWEIGHT', h: 168, reach: 170, stance: 'ORTHODOX', sex: 'MALE', bio: 'Võ sĩ đứng đòn, mạnh đòn tay. Thi hạng 60 kg giải mở rộng TP.HCM.' },
  { key: 'nhung', email: 'nhung.le@lotus-combat.test', first: 'Nhung', last: 'Lê', dob: '2001-07-22', wc: 'STRAWWEIGHT', h: 156, reach: 158, stance: 'ORTHODOX', sex: 'FEMALE', bio: 'Nền boxing nghiệp dư, đang chuẩn bị giải Boxing Hà Nội mở rộng hạng 48 kg.' },
  { key: 'long', email: 'long.pham@lotus-combat.test', first: 'Long', last: 'Phạm', dob: '1996-11-02', wc: 'WELTERWEIGHT', h: 180, reach: 185, stance: 'SOUTHPAW', sex: 'MALE', bio: 'Southpaw, mạnh đòn chân. Thua TKO hiệp 2 tại Lotus Fight Night 17.' },
  { key: 'khoa', email: 'khoa.hoang@lotus-combat.test', first: 'Khoa', last: 'Hoàng', dob: '1998-05-09', wc: 'FEATHERWEIGHT', h: 172, reach: 176, stance: 'ORTHODOX', sex: 'MALE', bio: 'Thua KO hiệp 1 tại Lotus Fight Night 16, đang chờ bác sĩ khám để tập lại.' },
  { key: 'tam', email: 'tam.vo@lotus-combat.test', first: 'Tâm', last: 'Võ', dob: '1995-01-27', wc: 'MIDDLEWEIGHT', h: 183, reach: 188, stance: 'ORTHODOX', sex: 'MALE', bio: 'Nền vật tự do, chuyên kiểm soát mặt sàn.' },
  { key: 'huy', email: 'huy.dang@lotus-combat.test', first: 'Huy', last: 'Đặng', dob: '2003-09-18', wc: 'FLYWEIGHT', h: 163, reach: 165, stance: 'SWITCH', sex: 'MALE', bio: 'Võ sĩ mới vào học viện tháng 11 qua tuyển sinh.' },
  { key: 'tuan', email: 'tuan.bui@lotus-combat.test', first: 'Tuấn', last: 'Bùi', dob: '1997-12-05', wc: 'LIGHTWEIGHT', h: 175, reach: 178, stance: 'ORTHODOX', sex: 'MALE', bio: 'Thắng điểm 3 hiệp tại Lotus Fight Night 17.' },
  { key: 'vy', email: 'vy.nguyen@lotus-combat.test', first: 'Vy', last: 'Nguyễn', dob: '2004-02-11', wc: 'STRAWWEIGHT', h: 155, reach: 157, stance: 'ORTHODOX', sex: 'FEMALE', bio: 'Mới chuyển từ CLB Muay Thái, chưa khám ban đầu.' },
];
const EXISTING_FIGHTERS = {
  minh: { email: 'minh.tran@lotus-combat.test', sex: 'MALE', stance: 'ORTHODOX', h: 174, reach: 178, bio: 'Võ sĩ chủ lực hạng 70 kg của Lotus Combat. Đứng đòn, phối hợp tay tốt, đang cải thiện phòng thủ đòn chân.' },
  kenji: { email: 'kenji.morita@lotus-combat.test', sex: 'MALE', stance: 'ORTHODOX', h: 170, reach: 173, bio: 'Nền karate, di chuyển tốt. Đang camp cho Lotus Fight Night 19.' },
  aigerim: { email: 'aigerim.sadykova@lotus-combat.test', sex: 'FEMALE', stance: 'ORTHODOX', h: 163, reach: 165, bio: 'Nền vật Kazakhstan. Đang camp cho Lotus Fight Night 20.' },
  lucas: { email: 'lucas.ferreira@lotus-combat.test', sex: 'MALE', stance: 'ORTHODOX', h: 180, reach: 183, bio: 'Nền BJJ. Đang phục hồi chấn thương gối phải.' },
};
// Tuyển sinh đã bỏ khỏi phạm vi (fight camp): không seed hồ sơ và tài khoản khách. Giữ mẫu để bật lại nếu cần.
const SEED_ADMISSIONS = false;
const GUEST_SAMPLES = [
  { email: 'kiet.phan@lotus-combat.test', first: 'Kiệt', last: 'Phan', dob: '2002-04-03', wc: 'LIGHTWEIGHT', status: 'SUBMITTED', submitted: at(-2, 20, 15), phone: '0903 412 588', training: '2 năm kickboxing tại CLB quận 7.', comp: 'Chưa thi đấu chính thức.', motivation: 'Muốn thi MMA nghiệp dư trong năm tới.' },
  { email: 'hai.ly@lotus-combat.test', first: 'Hải', last: 'Lý', dob: '2000-10-19', wc: 'FEATHERWEIGHT', status: 'PASSED', submitted: at(-9, 19, 40), phone: '0912 775 031', training: '4 năm Muay Thái, 1 năm BJJ.', comp: '5 trận Muay Thái nghiệp dư (4 thắng).', motivation: 'Chuyển sang MMA, cần môi trường tập có bác sĩ theo dõi.', coach: 'rafael', assessedAt: at(-5, 17), conclusion: 'PASS' },
  { email: 'quan.do@lotus-combat.test', first: 'Quân', last: 'Đỗ', dob: '1999-06-08', wc: 'WELTERWEIGHT', status: 'FAILED', submitted: at(-16, 21, 5), phone: '0938 220 917', training: '6 tháng tập gym, chưa học võ.', comp: 'Không có.', motivation: 'Muốn thử sức thi đấu.', coach: 'anna', assessedAt: at(-12, 16), conclusion: 'FAIL' },
  { email: 'linh.trinh@lotus-combat.test', first: 'Linh', last: 'Trịnh', dob: '2003-01-25', wc: 'FLYWEIGHT', status: 'APPROVED', submitted: at(-14, 18, 30), phone: '0976 118 402', training: '3 năm boxing, 1 năm vật.', comp: '3 trận boxing nghiệp dư (3 thắng).', motivation: 'Muốn thi MMA nữ hạng 52 kg.', coach: 'rafael', assessedAt: at(-10, 17), conclusion: 'PASS', decidedAt: at(-8, 10), decision: 'APPROVED' },
];
const GUESTS = SEED_ADMISSIONS ? GUEST_SAMPLES : [];

// ── kết nối ──────────────────────────────────────────────────────────────────
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = async (sql, params) => (await c.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
async function ins(table, row) {
  const keys = Object.keys(row).filter((k) => row[k] !== undefined);
  const sql = `insert into public.${table} (${keys.map((k) => `"${k}"`).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`;
  return one(sql, keys.map((k) => row[k]));
}
const counts = {};
const bump = (k, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };

const authHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' });
async function listAuthUsers() {
  const all = [];
  for (let page = 1; page < 50; page++) {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`auth list ${res.status}`);
    const { users } = await res.json();
    all.push(...users);
    if (users.length < 200) break;
  }
  return all;
}
/** Apply: tạo user trong Supabase Auth (mật khẩu ngẫu nhiên, không lưu). Chạy thử: chèn dòng tạm vào auth.users trong transaction. */
async function prepareAuthUsers(emails) {
  const ids = {};
  if (APPLY) {
    const existing = new Map((await listAuthUsers()).map((u) => [u.email, u.id]));
    for (const email of emails) {
      if (existing.has(email)) { ids[email] = existing.get(email); continue; }
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST', headers: authHeaders(),
        body: J({ email, password: randomBytes(18).toString('base64url'), email_confirm: true }),
      });
      if (!res.ok) throw new Error(`auth create ${email}: ${res.status} ${await res.text()}`);
      ids[email] = (await res.json()).id;
      bump('auth users tạo mới');
    }
  }
  return ids;
}
async function ensureAuthInTx(ids, email) {
  if (ids[email]) return ids[email];
  const found = await one(`select id from auth.users where email = $1`, [email]);
  if (found) return (ids[email] = found.id);
  const id = randomUUID();
  await q(`insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), now())`, [id, email]);
  return (ids[email] = id);
}

let currentActor = null;
async function actAs(userId) {
  if (currentActor === userId) return;
  const { auth_user_id: sub } = await one(`select auth_user_id from users where id = $1`, [userId]);
  await q(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [sub, J({ sub, role: 'authenticated' })]);
  currentActor = userId;
}

// ── sao lưu ──────────────────────────────────────────────────────────────────
const BACKUP_TABLES = [
  'users', 'fighters', 'coaches', 'sports_doctors', 'coach_fighters', 'doctor_fighters', 'bouts', 'bout_rounds', 'bout_requirements',
  'bout_ai_suggestions', 'bout_nutrition_checkins', 'suspensions', 'training_plans', 'training_plan_exercises', 'training_sessions',
  'session_exercises', 'session_rounds', 'fighter_measurements', 'medical_examinations', 'medical_examination_details',
  'medical_clearances', 'medical_clearance_revisions', 'injury_records', 'injury_record_revisions', 'treatments', 'recovery_plans',
  'recovery_plan_revisions', 'medical_review_requests', 'medical_review_request_revisions', 'medical_baseline_exemptions',
  'videos', 'ai_analyses', 'analysis_jobs', 'action_assessments', 'action_finding_reviews', 'coach_reviews', 'movement_evidence_reviews',
  'technique_references', 'technique_events', 'health_alerts', 'fighter_joint_states', 'notifications', 'user_permissions',
  'fighter_applications', 'fighter_application_coach_assignments', 'fighter_application_assessments', 'fighter_application_decisions',
  'fighter_application_activations', 'goals', 'audit_logs',
];
async function backup() {
  const dir = `C:/Users/LENOVO/Documents/mma-db-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  mkdirSync(dir, { recursive: true });
  for (const t of BACKUP_TABLES) writeFileSync(`${dir}/${t}.json`, J(await q(`select * from public.${t}`)));
  return dir;
}

// ── dọn dẹp (tắt trigger trong transaction, xoá cứng) ────────────────────────
async function cleanup(ctx) {
  await q(`set local session_replication_role = replica`);
  const keep = Object.values(KEEP_VIDEOS);
  const del = async (label, sql, params) => { const r = await c.query(sql, params); bump(`xoá ${label}`, r.rowCount); };

  // Video: giữ 4 video có kết quả AI thật, đặt lại về trạng thái chờ HLV duyệt.
  await del('action_finding_reviews', `delete from action_finding_reviews`);
  await del('coach_reviews', `delete from coach_reviews`);
  await del('movement_evidence_reviews', `delete from movement_evidence_reviews`);
  await del('action_assessments (video bỏ)', `delete from action_assessments where analysis_id in (select id from ai_analyses where video_id is null or video_id <> all($1::uuid[]))`, [keep]);
  for (const t of ['health_alerts', 'joint_health_history', 'technique_events', 'progress_snapshots', 'technique_references', 'fighter_joint_states', 'fighter_baselines', 'round_summaries', 'session_summaries', 'video_round_segments', 'goals']) {
    await del(t, `delete from ${t}`);
  }
  await del('ai_analyses (video bỏ)', `delete from ai_analyses where video_id is null or video_id <> all($1::uuid[])`, [keep]);
  await del('analysis_jobs (video bỏ)', `delete from analysis_jobs where video_id is null or video_id <> all($1::uuid[])`, [keep]);
  await del('videos (bỏ)', `delete from videos where id <> all($1::uuid[])`, [keep]);
  await q(`update ai_analyses set session_id = null where video_id = any($1::uuid[])`, [keep]);
  await q(`update analysis_jobs set session_id = null where video_id = any($1::uuid[])`, [keep]);
  await q(`update videos set session_id = null where id = any($1::uuid[])`, [keep]);

  for (const t of ['notifications', 'bout_ai_suggestions', 'bout_nutrition_checkins', 'bout_rounds', 'bout_requirements', 'suspensions', 'bouts',
    'session_exercises', 'session_rounds', 'training_sessions', 'training_plan_exercises', 'training_plans', 'fighter_measurements',
    'treatments', 'recovery_plan_revisions', 'recovery_plans', 'injury_record_revisions', 'injury_records',
    'medical_clearance_revisions', 'medical_clearances', 'medical_review_request_revisions', 'medical_review_requests',
    'medical_examination_details', 'medical_examinations', 'medical_baseline_exemptions', 'coach_fighters', 'doctor_fighters',
    'fighter_application_activations', 'fighter_application_decisions', 'fighter_application_assessments',
    'fighter_application_coach_assignments', 'fighter_applications']) {
    await del(t, `delete from ${t}`);
  }

  // 134 tài khoản @test.invalid sinh từ test e2e.
  const junk = (await q(`select id, auth_user_id from users where email like '%@test.invalid'`));
  ctx.junkAuthIds = junk.map((u) => u.auth_user_id);
  const junkIds = junk.map((u) => u.id);
  await del('audit_logs của tài khoản rác', `delete from audit_logs where actor_user_id = any($1::uuid[])`, [junkIds]);
  await del('user_permissions rác', `delete from user_permissions where user_id = any($1::uuid[]) or granted_by = any($1::uuid[])`, [junkIds]);
  await del('coaches rác', `delete from coaches where user_id = any($1::uuid[])`, [junkIds]);
  await del('fighters rác', `delete from fighters where user_id = any($1::uuid[])`, [junkIds]);
  await del('sports_doctors rác', `delete from sports_doctors where user_id = any($1::uuid[])`, [junkIds]);
  await del('users @test.invalid', `delete from users where id = any($1::uuid[])`, [junkIds]);
  // Tài khoản thử của team: xoá mềm, khôi phục được bằng cách đặt deleted_at = null.
  const mates = await q(`update users set is_active = false, deleted_at = coalesce(deleted_at, now()) where email = any($1) returning id`, [[...TEAMMATE_EMAILS, ...(SEED_ADMISSIONS ? [] : GUEST_SAMPLES.map((g) => g.email))]]);
  bump('users team xoá mềm', mates.length);
  await q(`update fighters set is_active = false, deleted_at = coalesce(deleted_at, now()) where user_id = any($1::uuid[])`, [mates.map((m) => m.id)]);
  // Hồ sơ võ sĩ đã xoá mềm từ trước: giữ nguyên.
  await q(`set local session_replication_role = origin`);
}

// ── seed ─────────────────────────────────────────────────────────────────────
async function seed(ctx) {
  const userByEmail = async (e) => one(`select * from users where email = $1`, [e]);
  const admin = await userByEmail('admin@gmail.com');
  const S = {}; // staff
  for (const [k, e] of [['rafael', 'rafael.costa@lotus-combat.test'], ['anna', 'anna.volkova@lotus-combat.test'], ['james', 'james.okafor@lotus-combat.test']]) {
    const u = await userByEmail(e); S[k] = { user: u.id, coach: (await one(`select id from coaches where user_id = $1`, [u.id])).id };
  }
  for (const [k, e] of [['thu', 'thu.le@lotus-combat.test'], ['samuel', 'samuel.brooks@lotus-combat.test']]) {
    const u = await userByEmail(e); S[k] = { user: u.id, doctor: (await one(`select id from sports_doctors where user_id = $1`, [u.id])).id };
  }
  const F = {};
  for (const [k, spec] of Object.entries(EXISTING_FIGHTERS)) {
    const u = await userByEmail(spec.email);
    const f = await one(`update fighters set sex = $2, dominant_stance = $3, height_cm = $4, reach_cm = $5, bio = $6, gym = 'Lotus Combat Academy', is_active = true where user_id = $1 returning *`, [u.id, spec.sex, spec.stance, spec.h, spec.reach, spec.bio]);
    F[k] = { id: f.id, user: u.id, name: `${f.first_name} ${f.last_name}`, first: f.first_name };
  }

  // Tài khoản mới: 8 võ sĩ + 4 người nộp hồ sơ.
  await actAs(admin.id);
  for (const nf of NEW_FIGHTERS) {
    let u = await userByEmail(nf.email);
    if (!u) {
      const authId = await ensureAuthInTx(ctx.authIds, nf.email);
      u = await ins('users', { email: nf.email, auth_user_id: authId, role: 'FIGHTER', is_active: true, created_at: at(-60, 9) });
      bump('users võ sĩ mới');
    }
    let f = await one(`select * from fighters where user_id = $1`, [u.id]);
    if (!f) {
      f = await ins('fighters', { user_id: u.id, first_name: nf.first, last_name: nf.last, date_of_birth: nf.dob, nationality: 'Vietnam', weight_class: nf.wc, height_cm: nf.h, reach_cm: nf.reach, dominant_stance: nf.stance, gym: 'Lotus Combat Academy', bio: nf.bio, sex: nf.sex, profile_role: 'FIGHTER', is_active: true, current_medical_status: 'NOT_CLEARED', created_at: nf.key === 'huy' ? at(-18, 10) : nf.key === 'vy' ? at(-4, 10) : at(-60, 9) });
      bump('fighters mới');
    }
    F[nf.key] = { id: f.id, user: u.id, name: `${nf.first} ${nf.last}`, first: nf.first };
  }
  const guestUsers = {};
  for (const g of GUESTS) {
    let u = await userByEmail(g.email);
    if (!u) {
      const authId = await ensureAuthInTx(ctx.authIds, g.email);
      u = await ins('users', { email: g.email, auth_user_id: authId, role: 'GUEST', is_active: true, created_at: plusMin(g.submitted, -30) });
      bump('users khách mới');
    }
    guestUsers[g.email] = u.id;
  }

  // Phân công HLV và bác sĩ.
  const roster = {
    minh: [['rafael', 'james'], 'thu', -90], kenji: [['rafael', 'james'], 'thu', -90], aigerim: [['rafael', 'anna'], 'thu', -90],
    lucas: [['anna', 'james'], ['samuel', 'thu'], -90], bao: [['rafael'], 'thu', -60], nhung: [['rafael', 'james'], 'thu', -60],
    long: [['rafael', 'anna'], 'thu', -60], khoa: [['rafael'], 'thu', -60], tam: [['anna'], ['samuel', 'thu'], -60],
    huy: [['rafael'], 'thu', -18], tuan: [['rafael', 'james'], 'thu', -60], vy: [['rafael'], 'thu', -4],
  };
  for (const [k, [coaches, doc, off]] of Object.entries(roster)) {
    for (const co of coaches) { await ins('coach_fighters', { coach_id: S[co].coach, fighter_id: F[k].id, assigned_by_id: admin.id, starts_at: at(off, 10), created_at: at(off, 10) }); bump('coach_fighters'); }
    const docs = [doc].flat();
    for (const d of docs) { await ins('doctor_fighters', { doctor_id: S[d].doctor, fighter_id: F[k].id, assigned_by_id: admin.id, starts_at: at(off, 10, 5), created_at: at(off, 10, 5) }); bump('doctor_fighters'); }
    F[k].coach = S[coaches[0]]; F[k].doctor = S[docs[0]];
  }

  // ── y tế ──
  const SCAT_TEMPLATE = ctx.scatTemplate;
  async function exam(k, { off, h = 9, type, scope = 'TRAINING', decision = 'ELIGIBLE', reason, weight, validDays = 180, restrict, assessments, recommendations }) {
    const doc = F[k].doctor; await actAs(doc.user);
    const examinedAt = at(off, h);
    const e = await ins('medical_examinations', {
      fighter_id: F[k].id, doctor_id: doc.doctor, recorded_by_id: doc.user, scope, decision, examined_at: examinedAt, reason,
      allowed_session_types: restrict?.sessions, excluded_joints: restrict?.joints, restriction_notes: restrict?.notes,
      valid_until: validDays ? at(off + validDays, 23, 59) : null, created_at: plusMin(examinedAt, 25),
    });
    const isBaseline = type === 'BASELINE';
    await ins('medical_examination_details', {
      examination_id: e.id, fighter_id: F[k].id, examination_type: type, weight_kg: weight, resting_heart_rate: 52 + (weight % 9 | 0),
      blood_pressure_systolic: 114 + (weight % 7 | 0), blood_pressure_diastolic: 72 + (weight % 5 | 0), temperature_c: 36.6, spo2_pct: 98, hydration: 'GOOD',
      assessments: J(assessments ?? [
        { area: 'Tim mạch', note: null, result: 'NORMAL' }, { area: 'Hô hấp', note: null, result: 'NORMAL' },
        { area: 'Cơ xương khớp', note: 'Tầm vận động các khớp lớn bình thường.', result: 'NORMAL' }, { area: 'Thần kinh', note: null, result: 'NORMAL' }]),
      recommendations: recommendations ?? (isBaseline ? 'Tái khám định kỳ sau 3 tháng hoặc ngay khi có chấn thương.' : null),
      follow_up_date: isBaseline ? day(off + 90) : null,
      scat6_form_version: isBaseline ? SCAT_TEMPLATE.scat6_form_version : null,
      scat6_responses: isBaseline ? J({ ...SCAT_TEMPLATE.scat6_responses, administeredAt: plusMin(examinedAt, 10) }) : null,
      scat6_scoring_version: isBaseline ? SCAT_TEMPLATE.scat6_scoring_version : null,
      scat6_scores: isBaseline ? J(SCAT_TEMPLATE.scat6_scores) : null,
      created_at: plusMin(examinedAt, 25),
    });
    await ins('fighter_measurements', { fighter_id: F[k].id, recorded_by_id: doc.user, measured_at: plusMin(examinedAt, 5), measurement_context: 'CHECKUP', weight_kg: weight, created_at: plusMin(examinedAt, 25) });
    bump(`khám ${scope}/${type}`);
    return e;
  }
  async function clearance(k, e, type, { validDays = 180, restrict, notes } = {}) {
    const doc = F[k].doctor; await actAs(doc.user);
    // Hồ sơ cũ cùng phạm vi chuyển sang hết hạn khi có giấy mới.
    const scopeTypes = type === 'COMPETITION' ? ['COMPETITION'] : ['TRAINING', 'RETURN_FROM_INJURY'];
    await q(`update medical_clearances set status = 'EXPIRED' where fighter_id = $1 and status = 'ACTIVE' and clearance_type = any($2::clearance_type[])`, [F[k].id, scopeTypes]);
    const from = plusMin(e.examined_at.toISOString(), 30);
    await ins('medical_clearances', {
      fighter_id: F[k].id, issued_by_id: doc.doctor, clearance_type: type, status: 'ACTIVE', valid_from: from,
      valid_until: e.valid_until ? e.valid_until.toISOString() : null, notes: notes ?? null,
      allowed_session_types: restrict?.sessions, excluded_joints: restrict?.joints, is_active: true, examination_id: e.id, created_at: from,
    });
    bump(`giấy phép ${type}`);
  }
  async function injury(k, { joint, type, severity, occurredOff, status, resolvedOff, description, treatments = [] }) {
    const doc = F[k].doctor; await actAs(doc.user);
    const inj = await ins('injury_records', {
      fighter_id: F[k].id, reported_by_id: doc.doctor, affected_joint: joint, injury_type: type, severity, occurred_at: at(occurredOff, 17),
      description, status: status === 'RESOLVED' ? 'ACTIVE' : status, is_active: true, created_at: at(occurredOff, 19),
    });
    for (const t of treatments) {
      await ins('treatments', { injury_id: inj.id, doctor_id: doc.doctor, treatment_date: at(t.off, 10), treatment_type: t.type, description: t.description, outcome_notes: t.outcome, next_review_at: t.nextOff != null ? at(t.nextOff, 10) : null, created_at: at(t.off, 11) });
      bump('treatments');
    }
    if (status === 'RESOLVED') await q(`update injury_records set status = 'RESOLVED', resolved_at = $2 where id = $1`, [inj.id, at(resolvedOff, 10)]);
    bump('injury_records');
    return inj;
  }
  const baseline = async (k, off, weight) => {
    const e = await exam(k, { off, type: 'BASELINE', weight, reason: 'Khám thể lực ban đầu đạt yêu cầu. Được phép tập luyện toàn phần, gồm đối kháng.' });
    await clearance(k, e, 'TRAINING');
    return e;
  };
  const preFight = async (k, off, weight, days = 90) => {
    const e = await exam(k, { off, h: 10, type: 'PRE_FIGHT', scope: 'COMPETITION', weight, validDays: days,
      reason: 'Khám trước thi đấu. Sinh hiệu bình thường, không có chấn thương đang điều trị.',
      assessments: [{ area: 'Tim mạch', note: null, result: 'NORMAL' }, { area: 'Sàng lọc thần kinh', note: null, result: 'NORMAL' }, { area: 'Sàng lọc mắt', note: null, result: 'NORMAL' }, { area: 'Sàng lọc cơ xương khớp', note: null, result: 'NORMAL' }, { area: 'Kiểm tra cân nặng', note: null, result: 'NORMAL' }] });
    await clearance(k, e, 'COMPETITION');
  };

  // Minh: khám ban đầu, 2 chấn thương cũ đã lành, khám định kỳ và khám thi đấu tuần này.
  await injury('minh', { joint: 'LEFT_ANKLE', type: 'Bong gân cổ chân độ I', severity: 'MINOR', occurredOff: -59, status: 'RESOLVED', resolvedOff: -44, description: 'Lật cổ chân trái khi đổi tầng ở buổi vật, sưng nhẹ mặt ngoài, đi lại được.',
    treatments: [{ off: -58, type: 'Chườm lạnh, băng ép, nghỉ tải', description: 'RICE 72 giờ, băng thun cổ chân, tạm dừng chạy và đá.', outcome: 'Giảm sưng sau 3 ngày.', nextOff: -51 }] });
  await baseline('minh', -38, 72.6);
  await injury('minh', { joint: 'RIGHT_WRIST', type: 'Đau khớp bàn – ngón tay phải', severity: 'MINOR', occurredOff: -30, status: 'RESOLVED', resolvedOff: -20, description: 'Đau khớp ngón 2–3 tay phải sau buổi bao nặng, không biến dạng.',
    treatments: [{ off: -29, type: 'Nghỉ đòn tay phải, quấn băng lại', description: 'Tạm dừng bao nặng 7 ngày, chỉnh cách quấn băng tay.', outcome: 'Hết đau khi nắm tay sau 10 ngày.', nextOff: -22 }] });
  const minhRoutine = await exam('minh', { off: -3, type: 'ROUTINE', weight: 72.0, validDays: 90, reason: 'Khám định kỳ 3 tháng. Không triệu chứng, các khớp ổn định. Được tập toàn phần.' });
  await clearance('minh', minhRoutine, 'TRAINING');
  await preFight('minh', -3, 72.0);

  await baseline('kenji', -45, 70.8);
  await preFight('kenji', -5, 69.6, 60);
  await injury('aigerim', { joint: 'RIGHT_WRIST', type: 'Căng cơ gấp cổ tay', severity: 'MINOR', occurredOff: -66, status: 'RESOLVED', resolvedOff: -50, description: 'Đau cổ tay phải sau buổi bao nặng, không sưng, không biến dạng.',
    treatments: [{ off: -65, type: 'Nghỉ tải, nẹp mềm ban đêm', description: 'Tạm dừng bao nặng, giãn cơ cẳng tay.', outcome: 'Hết đau sau 2 tuần.', nextOff: -55 }] });
  await baseline('aigerim', -31, 60.4);
  // Lucas: khám ban đầu, chấn thương gối khi đấu tập, khám sau chấn thương có giới hạn, kế hoạch phục hồi.
  await baseline('lucas', -46, 82.0);
  const lucasKnee = await injury('lucas', { joint: 'RIGHT_KNEE', type: 'Giãn dây chằng bên trong gối phải độ II', severity: 'MODERATE', occurredOff: -16, status: 'RECOVERING',
    description: 'Gối phải bị vặn vào trong khi bị quật ngã ở buổi đấu tập. Đau mặt trong gối, lỏng nhẹ khi test valgus.',
    treatments: [{ off: -15, type: 'Nẹp gối, nghỉ tải, chườm lạnh', description: 'Nẹp gối có bản lề 2 tuần, đi lại có nạng 5 ngày.', outcome: 'Giảm đau rõ, còn lỏng nhẹ.', nextOff: -8 },
      { off: -8, type: 'Vật lý trị liệu', description: 'Tập cơ tứ đầu đẳng trường, đạp xe nhẹ, không xoay gối.', outcome: 'Gấp gối 120°, hết đau khi đi.', nextOff: 1 }] });
  const lucasLimits = { sessions: ['SHADOW_BOXING', 'PAD_WORK', 'STRENGTH_CONDITIONING', 'RECOVERY', 'PHYSICAL_THERAPY'], joints: ['RIGHT_KNEE'], notes: 'Không đấu tập, không vật, không đá chân phải. Không xoay gối khi tải.' };
  const lucasExam = await exam('lucas', { off: -14, type: 'POST_INJURY', decision: 'ELIGIBLE_WITH_RESTRICTIONS', weight: 81.6, validDays: 30, restrict: lucasLimits,
    reason: 'Giãn dây chằng bên trong gối phải độ II. Được tập có giới hạn, tái khám sau 4 tuần.',
    assessments: [{ area: 'Cơ xương khớp', note: 'Đau mặt trong gối phải, valgus lỏng nhẹ, Lachman âm tính.', result: 'ABNORMAL' }, { area: 'Tim mạch', note: null, result: 'NORMAL' }] });
  await clearance('lucas', lucasExam, 'RETURN_FROM_INJURY', { restrict: lucasLimits, notes: lucasLimits.notes });
  await actAs(S.samuel.user);
  await ins('recovery_plans', { fighter_id: F.lucas.id, injury_id: lucasKnee.id, doctor_id: S.samuel.doctor, title: 'Phục hồi dây chằng gối phải', description: 'Không đấu tập, không vật, không đá chân phải cho tới khi bác sĩ khám lại.', start_date: day(-14), estimated_end_date: day(16), status: 'ACTIVE',
    milestones: J([
      { id: randomUUID(), title: 'Đi lại không đau, bỏ nạng', criteria: 'Đi 20 phút không đau', notes: null, targetDate: day(-9), completedAt: at(-10, 10), isCompleted: true },
      { id: randomUUID(), title: 'Gấp gối đủ 130°, tứ đầu khỏe lại', criteria: 'Gấp gối ≥ 130°, squat 1 chân không lệch', notes: null, targetDate: day(2), completedAt: null, isCompleted: false },
      { id: randomUUID(), title: 'Chạy thẳng và di chuyển bên', criteria: 'Chạy 10 phút, di chuyển bên không đau', notes: null, targetDate: day(9), completedAt: null, isCompleted: false },
      { id: randomUUID(), title: 'Bác sĩ khám lại, cho đấu tập', criteria: 'Valgus ổn định, test nhảy 1 chân ≥ 90 %', notes: null, targetDate: day(16), completedAt: null, isCompleted: false }]),
    created_at: at(-14, 11) });
  bump('recovery_plans');

  await baseline('bao', -49, 67.4);
  await preFight('bao', -6, 66.8, 30);
  await baseline('nhung', -35, 51.0);
  await preFight('nhung', -34, 51.0, 120);
  await baseline('long', -60, 80.2);
  await baseline('khoa', -80, 67.0);
  await baseline('tam', -55, 86.5);
  await baseline('huy', -16, 57.2);
  await baseline('tuan', -65, 73.5);
  await preFight('tuan', -16, 72.4, 60);
  // Khoa: khám sau KO, không đủ điều kiện → giấy tập bị thu hồi.
  await exam('khoa', { off: -38, h: 21, type: 'CONCUSSION_SCREEN', decision: 'NOT_ELIGIBLE', weight: 64.7, validDays: null,
    reason: 'Mất ý thức dưới 1 phút sau KO hiệp 1. Nghỉ toàn bộ tập luyện, khám lại khi hết đình chỉ trước khi tập trở lại.',
    assessments: [{ area: 'Sàng lọc thần kinh', note: 'Đau đầu, chóng mặt nhẹ, không dấu hiệu thần kinh khu trú.', result: 'ABNORMAL' }, { area: 'Tim mạch', note: null, result: 'NORMAL' }] });
  // Tâm: HLV Anna gửi yêu cầu khám, đang mở.
  await actAs(S.anna.user);
  await ins('medical_review_requests', { fighter_id: F.tam.id, requested_by_id: S.anna.user, requester_role: 'COACH', reason: 'Tâm báo đau thắt lưng dưới bên phải sau buổi vật chiều 17/11, cúi người bị đau. Nhờ bác sĩ khám trước khi tập tiếp.', status: 'OPEN', requested_at: at(-1, 8, 20), created_at: at(-1, 8, 20) });
  bump('medical_review_requests');

  // ── giáo án ──
  await actAs(S.rafael.user);
  const plans = {};
  async function plan(k, key, { title, phase, start, end, status = 'ACTIVE', goals, description, ex, coach }) {
    const p = await ins('training_plans', { fighter_id: F[k].id, coach_id: (coach ?? F[k].coach).coach, title, description, start_date: day(start), end_date: day(end), status, goals, is_active: true, milestones: J([]), phase, created_at: at(start - 2, 20) });
    let i = 0;
    for (const [exId, sets, reps, dur, rpe, note] of ex) { await ins('training_plan_exercises', { plan_id: p.id, exercise_id: exId, order_index: i++, sets, reps, duration_seconds: dur, target_rpe: rpe, coach_notes: note, created_at: at(start - 2, 20, 5) }); bump('training_plan_exercises'); }
    plans[key] = p; bump('training_plans');
    return p;
  }
  const strikingEx = [[EX.jchPads, 6, null, 180, 7, 'Giữ tay sau sau mỗi tổ hợp'], [EX.bagPower, 5, null, 180, 8, null], [EX.slipRoll, 3, null, 120, 5, null], [EX.rope, 3, null, 180, 6, null], [EX.mobility, 1, null, 600, 2, null]];
  const campEx = [[EX.sparring, 5, null, 180, 8, 'Đấu tập theo kịch bản đối thủ'], [EX.jchPads, 6, null, 180, 7, null], [EX.chain, 4, 6, null, 7, null], [EX.bike, 8, null, 30, 9, '30 giây nhanh, 60 giây nghỉ'], [EX.hip9090, 1, null, 600, 2, null]];
  const baseEx = [[EX.shadowFoot, 4, null, 180, 5, null], [EX.jabCross, 5, null, 180, 6, null], [EX.deadlift, 4, 5, null, 7, null], [EX.split, 3, 8, null, 7, null], [EX.thoracic, 1, null, 600, 2, null]];
  const rehabEx = [[EX.nordic, 3, 6, null, 5, 'Biên độ không đau'], [EX.split, 3, 10, null, 5, 'Chân phải không tải quá 50 %'], [EX.shadowFoot, 3, null, 120, 4, 'Không xoay gối phải'], [EX.hip9090, 1, null, 600, 2, null]];
  const maintEx = [[EX.shadowFoot, 3, null, 180, 4, null], [EX.kb, 4, 15, null, 6, null], [EX.neck, 3, null, 30, 4, null], [EX.mobility, 1, null, 900, 2, null]];

  await plan('minh', 'minhCampPast', { title: 'Trại thi đấu – Lotus Fight Night 15', phase: 'fight_camp', start: -114, end: -74, status: 'COMPLETED', goals: 'Về 70 kg an toàn, ba hiệp đủ thể lực.', ex: campEx });
  await plan('minh', 'minh', { title: 'Giai đoạn xây dựng – Minh Trần', phase: 'build', start: -17, end: 25, goals: 'Tăng sức bền yếm khí và phòng thủ đòn chân trước trận tiếp theo.', description: 'Tập 5–6 buổi/tuần, cân mỗi sáng và ghi lại.', ex: strikingEx });
  await plan('kenji', 'kenjiCampPast', { title: 'Trại thi đấu – Lotus Fight Night 16', phase: 'fight_camp', start: -80, end: -39, status: 'COMPLETED', goals: 'Giữ cự ly, đòn chân trước.', ex: campEx });
  await plan('kenji', 'kenji', { title: 'Trại thi đấu – Lotus Fight Night 19', phase: 'fight_camp', start: -24, end: 24, goals: 'Đạt đỉnh ngày 13/12: hoàn thiện chiến thuật, về 65 kg an toàn.', description: 'Đấu tập trong giới hạn giấy phép y tế. Cân mỗi sáng.', ex: campEx });
  await plan('aigerim', 'aigerim', { title: 'Trại thi đấu – Lotus Fight Night 20', phase: 'fight_camp', start: -3, end: 37, goals: 'Về 56 kg, tăng tỉ lệ vật ngã thành công.', ex: campEx, coach: S.rafael });
  await plan('lucas', 'lucas', { title: 'Phục hồi gối phải – Lucas Ferreira', phase: 'rehab', start: -13, end: 16, goals: 'Trở lại đấu tập sau khi bác sĩ khám lại.', description: 'Theo giới hạn của giấy phép y tế: không đấu tập, không vật, không đá chân phải.', ex: rehabEx, coach: S.anna });
  await plan('bao', 'bao', { title: 'Trại thi đấu – Giải MMA mở rộng TP.HCM', phase: 'fight_camp', start: -38, end: 3, goals: 'Về 60 kg an toàn, thắng bằng đòn tay.', ex: campEx });
  await plan('nhung', 'nhung', { title: 'Trại thi đấu – Giải Boxing Hà Nội mở rộng', phase: 'fight_camp', start: -31, end: 10, goals: 'Ba hiệp boxing đủ thể lực, về 48 kg.', ex: strikingEx });
  await plan('long', 'longCampPast', { title: 'Trại thi đấu – Lotus Fight Night 17', phase: 'fight_camp', start: -52, end: -12, status: 'COMPLETED', goals: 'Về 77 kg, đòn chân trái.', ex: campEx });
  await plan('long', 'long', { title: 'Duy trì trong thời gian đình chỉ – Long Phạm', phase: 'maintenance', start: -10, end: 19, goals: 'Giữ thể lực, không đấu tập và không vật cho tới khi bác sĩ cho phép.', ex: maintEx });
  await plan('khoa', 'khoaCampPast', { title: 'Trại thi đấu – Lotus Fight Night 16', phase: 'fight_camp', start: -80, end: -39, status: 'COMPLETED', goals: 'Về 65 kg.', ex: campEx });
  await plan('tam', 'tam', { title: 'Nền tảng thể lực – Tâm Võ', phase: 'base', start: -24, end: 18, goals: 'Tăng sức bền, cải thiện đứng đòn.', ex: baseEx, coach: S.anna });
  await plan('huy', 'huy', { title: 'Nền tảng cho võ sĩ mới – Huy Đặng', phase: 'base', start: -14, end: 28, goals: 'Nắm kỹ thuật cơ bản, tập đều 4 buổi/tuần.', ex: baseEx });
  await plan('tuan', 'tuanCampPast', { title: 'Trại thi đấu – Lotus Fight Night 17', phase: 'fight_camp', start: -52, end: -12, status: 'COMPLETED', goals: 'Thắng điểm, giữ nhịp 3 hiệp.', ex: campEx });
  await plan('tuan', 'tuan', { title: 'Giai đoạn xây dựng – Tuấn Bùi', phase: 'build', start: -4, end: 38, goals: 'Tăng sức mạnh thân dưới, vật phòng thủ.', ex: strikingEx });
  await plan('vy', 'vy', { title: 'Nền tảng – Vy Nguyễn (chờ khám ban đầu)', phase: 'base', start: 0, end: 42, status: 'DRAFT', goals: 'Bắt đầu sau khi bác sĩ khám ban đầu.', ex: baseEx });

  // ── buổi tập: tuần trước (9–15/11) và tuần này (16–22/11) ──
  const TITLES = {
    PAD_WORK: 'Ôm đích: phối hợp đòn 3–4 nhịp', STRENGTH_CONDITIONING: 'Thể lực: sức mạnh thân dưới', GRAPPLING: 'Vật: kiểm soát lưng lồng và đứng dậy',
    SPARRING: 'Đối kháng có kiểm soát 5×3 phút', HEAVY_BAG: 'Bao nặng: đòn chân và đổi tầng', RECOVERY: 'Hồi phục: giãn cơ, lăn cơ, thở',
    SHADOW_BOXING: 'Đánh bóng: di chuyển và góc thoát', TACTICAL_ANALYSIS: 'Xem băng: đọc đối thủ', PHYSICAL_THERAPY: 'Vật lý trị liệu gối phải',
  };
  const ROOM = { STRENGTH_CONDITIONING: 'Lotus Combat – Phòng thể lực', RECOVERY: 'Lotus Combat – Phòng hồi phục', PHYSICAL_THERAPY: 'Lotus Combat – Phòng hồi phục', GRAPPLING: 'Lotus Combat – Khu vật', TACTICAL_ANALYSIS: 'Lotus Combat – Phòng họp' };
  const ROUNDS = { PAD_WORK: 6, SPARRING: 5, HEAVY_BAG: 6, SHADOW_BOXING: 4, GRAPPLING: 5 };
  // [thứ (0 = thứ Hai), giờ, loại, phút]
  const WEEK = {
    minh: [[0, 9, 'PAD_WORK', 90], [1, 16, 'STRENGTH_CONDITIONING', 60], [2, 9, 'SPARRING', 75], [3, 7, 'SHADOW_BOXING', 45], [4, 9, 'GRAPPLING', 90], [5, 8, 'RECOVERY', 45]],
    kenji: [[0, 16, 'HEAVY_BAG', 75], [1, 9, 'SPARRING', 60], [3, 16, 'PAD_WORK', 75], [4, 16, 'STRENGTH_CONDITIONING', 60]],
    aigerim: [[0, 7, 'STRENGTH_CONDITIONING', 60], [2, 16, 'GRAPPLING', 90], [3, 9, 'PAD_WORK', 60], [5, 9, 'SPARRING', 60]],
    lucas: [[0, 10, 'PHYSICAL_THERAPY', 45], [2, 10, 'PHYSICAL_THERAPY', 45], [3, 15, 'STRENGTH_CONDITIONING', 45], [4, 10, 'SHADOW_BOXING', 30]],
    nhung: [[0, 17, 'PAD_WORK', 60], [1, 17, 'HEAVY_BAG', 60], [3, 17, 'SPARRING', 60], [5, 9, 'STRENGTH_CONDITIONING', 60]],
    huy: [[0, 16, 'SHADOW_BOXING', 60], [2, 16, 'PAD_WORK', 60], [3, 16, 'STRENGTH_CONDITIONING', 60]],
    tuan: [[0, 9, 'HEAVY_BAG', 60], [1, 16, 'GRAPPLING', 75], [3, 15, 'PAD_WORK', 60], [4, 9, 'SPARRING', 60]],
  };
  const sessionsPlan = [];
  for (const [k, pattern] of Object.entries(WEEK)) for (const wk of [-10, -3]) for (const p of pattern) sessionsPlan.push([k, wk + p[0], ...p.slice(1)]);
  // Bảo: tuần trước camp nặng, tuần này tuần thi đấu nhẹ dần.
  for (const p of [[-10, 9, 'SPARRING', 75], [-9, 16, 'PAD_WORK', 75], [-8, 9, 'GRAPPLING', 90], [-6, 9, 'SPARRING', 60], [-5, 16, 'STRENGTH_CONDITIONING', 60],
    [-3, 9, 'PAD_WORK', 60], [-2, 9, 'SHADOW_BOXING', 45], [-1, 16, 'SHADOW_BOXING', 40], [0, 9, 'SHADOW_BOXING', 30], [1, 9, 'RECOVERY', 30]]) sessionsPlan.push(['bao', ...p]);
  // Long: đình chỉ từ 8/11, chỉ buổi không bị chặn.
  for (const p of [[-9, 10, 'RECOVERY', 45], [-7, 15, 'STRENGTH_CONDITIONING', 60], [-5, 10, 'SHADOW_BOXING', 45], [-2, 10, 'RECOVERY', 45], [0, 15, 'STRENGTH_CONDITIONING', 60], [2, 10, 'SHADOW_BOXING', 45]]) sessionsPlan.push(['long', ...p]);
  // Tâm: tập bình thường tới chiều 17/11.
  for (const p of [[-10, 16, 'GRAPPLING', 90], [-8, 16, 'STRENGTH_CONDITIONING', 60], [-6, 16, 'GRAPPLING', 90], [-3, 16, 'STRENGTH_CONDITIONING', 60], [-2, 16, 'GRAPPLING', 90], [0, 16, 'GRAPPLING', 90]]) sessionsPlan.push(['tam', ...p]);
  const SKIP = new Set(['kenji:-9', 'huy:-8']);
  let seq = 0;
  for (const [k, off, h, type, min] of sessionsPlan.sort((a, b) => a[1] - b[1] || a[2] - b[2])) {
    // Tuấn nghỉ bắt buộc tới 14/11: tuần trước chỉ hồi phục.
    if (k === 'tuan' && off < -4 && off !== -10 && off !== -7) continue;
    const pk = { minh: 'minh', kenji: 'kenji', aigerim: 'aigerim', lucas: 'lucas', nhung: 'nhung', huy: 'huy', bao: 'bao', long: off < -10 ? 'longCampPast' : 'long', tam: 'tam', tuan: off < -4 ? null : 'tuan' }[k];
    const realType = k === 'tuan' && off < -4 ? 'RECOVERY' : type;
    const scheduledAt = at(off, h);
    const coach = (realType === 'STRENGTH_CONDITIONING' && ['minh', 'kenji', 'nhung', 'tuan'].includes(k)) ? S.james : F[k].coach;
    const row = {
      fighter_id: F[k].id, coach_id: coach.coach, plan_id: pk ? plans[pk].id : null, title: TITLES[realType], scheduled_at: scheduledAt,
      planned_duration_sec: min * 60, location: ROOM[realType] ?? 'Lotus Combat – Sàn chính', session_type: realType, status: 'SCHEDULED',
      round_count: ROUNDS[realType] ?? 0, is_active: true, created_at: at(off - 4, 20, 10 + (seq % 40)),
    };
    seq++;
    const tag = `${k}:${off}`;
    if (k === 'tam' && off === 0) {
      Object.assign(row, { status: 'CANCELLED', cancelled_at: at(-1, 8, 30), cancellation_reason: 'Chờ bác sĩ khám lưng (HLV đã gửi yêu cầu khám 18/11).' });
    } else if (isPast(plusMin(scheduledAt, min))) {
      if (SKIP.has(tag)) Object.assign(row, { status: 'SKIPPED', skipped_at: plusMin(scheduledAt, 15), coach_notes: k === 'kenji' ? 'Kenji sốt nhẹ, nghỉ một buổi.' : 'Huy báo bận học, bù vào thứ Sáu.' });
      else {
        const rpe = Math.min(9, 4 + ((seq * 7 + h) % 5) + (realType === 'SPARRING' ? 1 : 0) - (realType === 'RECOVERY' || realType === 'PHYSICAL_THERAPY' ? 2 : 0));
        Object.assign(row, { status: 'COMPLETED', checked_in_at: plusMin(scheduledAt, -5), completed_at: plusMin(scheduledAt, min - 3), actual_duration_sec: (min - 3) * 60, reported_rpe: Math.max(2, rpe) });
        if (k === 'tam' && off === -2) Object.assign(row, { reported_rpe: 8, coach_notes: 'Cuối buổi Tâm báo đau thắt lưng dưới bên phải khi cúi người. Đã dừng phần vật mặt sàn.' });
        if (k === 'minh' && off === -1) row.coach_notes = 'Đấu tập tốt, còn hạ tay phải sau đòn đá thấp.';
      }
    }
    await ins('training_sessions', row); bump(`buổi tập ${row.status}`);
  }

  // ── cân nặng ──
  async function weights(k, fromOff, toOff, fromKg, toKg, every = 1, skip = []) {
    const n = Math.floor((toOff - fromOff) / every);
    for (let i = 0; i <= n; i++) {
      const off = fromOff + i * every;
      if (skip.includes(off)) continue;
      const wobble = Math.sin(i * 1.7) * 0.25;
      const kg = r1(fromKg + ((toKg - fromKg) * i) / Math.max(1, n) + (i === n ? 0 : wobble));
      await ins('fighter_measurements', { fighter_id: F[k].id, recorded_by_id: F[k].user, measured_at: at(off, 6, 45), measurement_context: 'SELF_REPORTED', weight_kg: kg, created_at: at(off, 6, 46) });
      bump('cân nặng');
    }
  }
  await weights('minh', -28, 0, 73.4, 71.6, 1, [-26, -19, -12, -5]);
  await weights('kenji', -24, -1, 70.8, 69.1, 1, [-20, -13, -9, -6]);
  await weights('aigerim', -14, -1, 60.6, 59.4, 2);
  await weights('lucas', -21, -1, 82.2, 81.4, 3);
  await weights('bao', -38, -1, 68.6, 66.1, 1, [-33, -27, -20]);
  await weights('nhung', -31, -1, 51.2, 50.2, 1, [-29, -22, -15, -8, -3]);
  await weights('long', -10, -1, 79.6, 79.9, 3);
  await weights('tam', -21, -2, 86.8, 86.2, 3);
  await weights('huy', -14, -1, 57.4, 57.0, 2);
  await weights('tuan', -11, -1, 72.8, 73.1, 2);
  await weights('vy', -3, -1, 49.6, 49.4, 1);

  // ── trận đấu ──
  await actAs(S.rafael.user);
  const R = S.rafael.user;
  const histTo = (steps) => steps.map(([from, to, t, extra]) => ({ at: t, by: R, to, from, ...(extra ?? {}) }));
  function analysis({ profile, observations, tactics, reviewed }) {
    return {
      profile, observations, updatedAt: at(-1, 9), updatedById: R,
      tactics: tactics.map((t, i) => ({ id: `tac-${i + 1}`, text: t.text, round: t.round ?? null, sessionIds: [], partnerBrief: t.partner ?? null, observationIds: t.obs,
        ...(reviewed ? { review: { auto: !t.note, note: t.note ?? null, outcome: t.outcome } } : {}) })),
    };
  }
  const obs = (id, kind, text, confidence, note, time) => ({ id, kind, text, confidence, evidenceUrl: null, evidenceNote: note, evidenceTime: time ?? null });
  async function bout(k, b) {
    const row = await ins('bouts', {
      fighter_id: F[k].id, coach_id: F[k].coach.coach, ruleset_id: b.ruleset ?? VMMAF, event_name: b.event, venue: b.venue, opponent_name: b.opponent,
      weight_class_code: b.wc, weight_limit_kg: b.limit, acute_loss_limit_pct: 8.0, requirements_due_days: 7, weigh_in_at: b.weighIn, bout_at: b.boutAt,
      status: b.status, training_plan_id: b.plan ? plans[b.plan].id : null, official_weight_kg: b.official, made_weight: b.official != null ? true : null,
      hydration_check: b.official != null ? 'NOT_APPLICABLE' : null, result: b.result, method: b.method, result_round: b.round, knocked_down: b.knockedDown,
      cancel_reason: b.cancel, notes: b.notes, history: J(b.history), created_by_id: R, created_at: b.created, opponent_analysis: J(b.analysis ?? {}),
      scheduled_rounds: b.rounds ?? 3, nutrition_plan: J(b.nutrition ?? {}),
    });
    if (b.official != null) await ins('fighter_measurements', { fighter_id: F[k].id, recorded_by_id: R, measured_at: plusMin(b.weighIn, 10), measurement_context: 'WEIGH_IN', weight_kg: b.official, created_at: plusMin(b.weighIn, 12) });
    for (const [i, rd] of (b.roundLog ?? []).entries()) {
      await ins('bout_rounds', { bout_id: row.id, round_no: i + 1, tactic_marks: J(rd.t), observation_marks: J(rd.o ?? {}), self_score: rd.s, knockdowns_against: rd.kd ?? 0, stunned: !!rd.stunned, bleeding: !!rd.bleeding, fatigued: !!rd.fatigued, note: rd.note ?? null, recorded_by_id: R, created_at: plusMin(b.boutAt, 6 * (i + 1)), next_round_plan: J(rd.next ?? {}) });
      bump('bout_rounds');
    }
    for (const req of b.requirements ?? []) { await ins('bout_requirements', { bout_id: row.id, ...req, created_at: b.created }); bump('bout_requirements'); }
    bump(`trận ${b.status}`);
    return row;
  }
  const nutrition = (camp, fightWeek) => ({
    camp: { text: camp, author: 'Rafael Costa', updatedAt: at(-20, 9), updatedById: R },
    ...(fightWeek ? { fightWeek: { text: fightWeek, author: 'Rafael Costa', updatedAt: at(-5, 9), updatedById: R } } : {}),
  });
  const profile = (style, stance, w, l, src, h, reach) => ({ wins: w, draws: 0, style, losses: l, source: src, stance, reachCm: reach, heightCm: h });

  // Minh thắng điểm LFN 15.
  await bout('minh', { event: 'Lotus Fight Night 15', venue: 'Nhà thi đấu Phú Thọ, TP.HCM', opponent: 'Khánh Phạm', wc: '70', limit: 70, status: 'COMPLETED', plan: 'minhCampPast',
    weighIn: at(-75, 8), boutAt: at(-74, 20), official: 69.6, result: 'WIN', method: 'DECISION', round: 3, knockedDown: false, created: at(-118, 10),
    history: histTo([['SCHEDULED', 'CAMP', at(-114, 9)], ['CAMP', 'FIGHT_WEEK', at(-82, 9)], ['FIGHT_WEEK', 'WEIGHED_IN', at(-75, 8, 15)], ['WEIGHED_IN', 'COMPLETED', at(-74, 21), { lossOfConsciousness: 'NONE' }]]),
    analysis: analysis({ reviewed: true, profile: profile('WRESTLER', 'ORTHODOX', 5, 1, 'Băng hình 2 trận gần nhất', 172, 174),
      observations: [obs('obs-1', 'HABIT', 'Cúi đầu lao vào ôm chân khi bị dồn về lồng', 'REPEATED', 'Hai trận gần nhất, hiệp 2', '02:10'), obs('obs-2', 'OPENING', 'Hở cằm sau cú vật hụt', 'ONCE', 'Trận gặp Lực Vũ 2025', null)],
      tactics: [{ text: 'Sprawl rồi móc ngược khi đối thủ cúi đầu lao vào', obs: ['obs-1'], outcome: 'EFFECTIVE' }, { text: 'Giữ trung tâm sàn, không lùi về lồng', obs: ['obs-1'], outcome: 'EFFECTIVE' }, { text: 'Gối lên khi đối thủ cúi đầu', round: 3, obs: ['obs-2'], outcome: 'NOT_USED' }] }),
    roundLog: [{ t: { 'tac-1': 'EFFECTIVE', 'tac-2': 'EFFECTIVE', 'tac-3': 'NOT_USED' }, o: { 'obs-1': 'SEEN' }, s: 'WIN' }, { t: { 'tac-1': 'EFFECTIVE', 'tac-2': 'INEFFECTIVE', 'tac-3': 'NOT_USED' }, o: { 'obs-1': 'SEEN' }, s: 'CLOSE', fatigued: true }, { t: { 'tac-1': 'EFFECTIVE', 'tac-2': 'EFFECTIVE', 'tac-3': 'NOT_USED' }, o: { 'obs-2': 'NOT_SEEN' }, s: 'WIN' }] });
  // Kenji thắng TKO LFN 16; Khoa thua KO cùng giải.
  await bout('kenji', { event: 'Lotus Fight Night 16', venue: 'Nhà thi đấu Phú Thọ, TP.HCM', opponent: 'Tùng Lâm', wc: '65', limit: 65, status: 'COMPLETED', plan: 'kenjiCampPast',
    weighIn: at(-40, 8), boutAt: at(-39, 20), official: 64.8, result: 'WIN', method: 'TKO', round: 2, knockedDown: false, created: at(-84, 10),
    history: histTo([['SCHEDULED', 'CAMP', at(-80, 9)], ['CAMP', 'FIGHT_WEEK', at(-47, 9)], ['FIGHT_WEEK', 'WEIGHED_IN', at(-40, 8, 15)], ['WEIGHED_IN', 'COMPLETED', at(-39, 21), { lossOfConsciousness: 'NONE' }]]) });
  const khoaBout = await bout('khoa', { event: 'Lotus Fight Night 16', venue: 'Nhà thi đấu Phú Thọ, TP.HCM', opponent: 'Đức Huỳnh', wc: '65', limit: 65, status: 'COMPLETED', plan: 'khoaCampPast',
    weighIn: at(-40, 8), boutAt: at(-39, 20, 30), official: 64.7, result: 'LOSS', method: 'KO', round: 1, knockedDown: true, created: at(-84, 10),
    history: histTo([['SCHEDULED', 'CAMP', at(-80, 9)], ['CAMP', 'FIGHT_WEEK', at(-47, 9)], ['FIGHT_WEEK', 'WEIGHED_IN', at(-40, 8, 20)], ['WEIGHED_IN', 'COMPLETED', at(-39, 21, 10), { lossOfConsciousness: 'UNDER_1_MIN' }]]),
    roundLog: [{ t: {}, s: 'LOSS', kd: 1, stunned: true, note: 'Trúng móc phải ở phút thứ 2, mất ý thức vài giây.' }] });
  // Long thua TKO, Tuấn thắng điểm tại LFN 17; Lucas rút vì chấn thương.
  const longAnalysis = analysis({ reviewed: true, profile: profile('STRIKER', 'ORTHODOX', 7, 2, 'Băng hình giải mở rộng 2025', 182, 186),
    observations: [obs('obs-1', 'STRENGTH', 'Đấm thẳng tay phải rất nhanh ở cự ly trung', 'REPEATED', 'Thắng 3 trận gần nhất bằng đòn này', '00:48'), obs('obs-2', 'HABIT', 'Bước vào thẳng, không đổi góc', 'REPEATED', 'Hai trận gần nhất', null), obs('obs-3', 'OPENING', 'Đứng trụ nặng, chậm chân khi bị đá thấp', 'ONCE', 'Ghi chép góc đài 2025', null)],
    tactics: [{ text: 'Đá thấp chân trái vào đùi trước liên tục', obs: ['obs-3'], partner: 'Bạn tập đứng orthodox, bước vào thẳng', outcome: 'EFFECTIVE' }, { text: 'Lùi chéo sang phải, tránh đường đấm thẳng', obs: ['obs-1', 'obs-2'], outcome: 'INEFFECTIVE', note: 'Long vẫn lùi thẳng về lồng ở hiệp 2.' }, { text: 'Vật ôm hai chân khi đối thủ bước vào', round: 2, obs: ['obs-2'], outcome: 'NOT_USED' }] });
  const longBout = await bout('long', { event: 'Lotus Fight Night 17', venue: 'Nhà văn hoá Thanh niên, TP.HCM', opponent: 'Hiếu Châu', wc: '77', limit: 77, status: 'COMPLETED', plan: 'longCampPast',
    weighIn: at(-13, 8), boutAt: at(-12, 20), official: 76.8, result: 'LOSS', method: 'TKO', round: 2, knockedDown: true, created: at(-56, 10), analysis: longAnalysis,
    history: histTo([['SCHEDULED', 'CAMP', at(-52, 9)], ['CAMP', 'FIGHT_WEEK', at(-20, 9)], ['FIGHT_WEEK', 'WEIGHED_IN', at(-13, 8, 15)], ['WEIGHED_IN', 'COMPLETED', at(-12, 21), { lossOfConsciousness: 'NONE' }]]),
    roundLog: [{ t: { 'tac-1': 'EFFECTIVE', 'tac-2': 'INEFFECTIVE', 'tac-3': 'NOT_USED' }, o: { 'obs-1': 'SEEN', 'obs-3': 'SEEN' }, s: 'CLOSE', next: { addedTactics: [], instructions: [{ code: 'CUSTOM', text: 'Đổi góc sang phải ngay sau đòn đá thấp' }, { code: 'STOP_TACTIC', tacticId: 'tac-2' }], focusTacticIds: ['tac-1', 'tac-2'] } },
      { t: { 'tac-1': 'EFFECTIVE', 'tac-2': 'INEFFECTIVE', 'tac-3': 'NOT_USED' }, o: { 'obs-1': 'SEEN' }, s: 'LOSS', kd: 1, stunned: true, note: 'Bị đánh ngã bởi đấm thẳng tay phải, trọng tài dừng trận.' }] });
  await bout('tuan', { event: 'Lotus Fight Night 17', venue: 'Nhà văn hoá Thanh niên, TP.HCM', opponent: 'Phát Trương', wc: '70', limit: 70, status: 'COMPLETED', plan: 'tuanCampPast',
    weighIn: at(-13, 8), boutAt: at(-12, 19), official: 69.8, result: 'WIN', method: 'DECISION', round: 3, knockedDown: false, created: at(-56, 10),
    history: histTo([['SCHEDULED', 'CAMP', at(-52, 9)], ['CAMP', 'FIGHT_WEEK', at(-20, 9)], ['FIGHT_WEEK', 'WEIGHED_IN', at(-13, 8, 10)], ['WEIGHED_IN', 'COMPLETED', at(-12, 20), { lossOfConsciousness: 'NONE' }]]),
    roundLog: [{ t: {}, s: 'WIN' }, { t: {}, s: 'CLOSE', fatigued: true }, { t: {}, s: 'WIN' }] });
  await bout('lucas', { event: 'Lotus Fight Night 17', venue: 'Nhà văn hoá Thanh niên, TP.HCM', opponent: 'Gia Bảo Ngô', wc: '84', limit: 84, status: 'CANCELLED', weighIn: at(-13, 8), boutAt: at(-12, 21),
    cancel: 'Rút khỏi trận do giãn dây chằng gối phải (bác sĩ Samuel Brooks).', created: at(-56, 10),
    history: histTo([['SCHEDULED', 'CAMP', at(-52, 9)], ['CAMP', 'CANCELLED', at(-15, 18), { reason: 'Rút khỏi trận do giãn dây chằng gối phải (bác sĩ Samuel Brooks).' }]]) });

  // Trận sắp tới.
  const tacticsUpcoming = [{ text: 'Bước chéo sang trái, phản đòn móc trái khi đối thủ thu chân đá thấp', obs: ['obs-1'], partner: 'Bạn tập đứng southpaw, đá thấp chân sau rồi hạ tay phải' },
    { text: 'Ép góc bằng chuỗi jab, không cho lùi thẳng', round: 1, obs: ['obs-2'], partner: 'Bạn tập lùi thẳng về lồng khi bị áp sát' },
    { text: 'Tăng nhịp đòn vào bụng và đổi tầng vật từ giữa hiệp 2', obs: ['obs-3'] }];
  const obsUpcoming = [obs('obs-1', 'HABIT', 'Hạ tay phải sau khi đá thấp chân sau', 'REPEATED', 'Lặp lại ở hiệp 1 và hiệp 2 trận bán kết 2025', '01:45'),
    obs('obs-2', 'OPENING', 'Lùi thẳng về phía lồng khi bị áp sát bằng đòn tay', 'REPEATED', 'Trận chung kết 2025, hiệp 2', null),
    obs('obs-3', 'HABIT', 'Nhịp thở chậm lại, đứng trụ nặng từ cuối hiệp 2', 'ONCE', 'Ghi chép góc đài tại giải mở rộng', null)];
  await bout('bao', { event: 'Giải MMA mở rộng TP.HCM 2026', venue: 'Nhà thi đấu Rạch Miễu, TP.HCM', opponent: 'Thắng Lê', wc: '60', limit: 60, status: 'FIGHT_WEEK', plan: 'bao',
    weighIn: at(2, 8), boutAt: at(3, 19), created: at(-42, 10), notes: 'Trận 3 hiệp × 5 phút.',
    history: histTo([['SCHEDULED', 'CAMP', at(-38, 9)], ['CAMP', 'FIGHT_WEEK', at(-5, 9)]]),
    analysis: analysis({ profile: profile('STRIKER', 'SOUTHPAW', 6, 2, 'Băng hình giải CLB 2025', 166, 168), observations: obsUpcoming, tactics: tacticsUpcoming }),
    nutrition: nutrition('Thâm hụt 400 kcal/ngày; đạm 2 g/kg; tinh bột quanh buổi tập; 3–4 lít nước/ngày.', 'Giảm muối và chất xơ từ thứ Ba; nước 6 lít → 2 lít theo lịch; không xông hơi nếu chưa hỏi bác sĩ.') });
  await bout('nhung', { event: 'Giải Boxing Hà Nội mở rộng 2026', venue: 'Cung thể thao Quần Ngựa, Hà Nội', opponent: 'Hà My Đinh', wc: '48', limit: 48, ruleset: AIBA, status: 'CAMP', plan: 'nhung',
    weighIn: at(9, 8), boutAt: at(10, 15), created: at(-33, 10), notes: 'Boxing nghiệp dư 3 hiệp × 3 phút, có mũ bảo hộ.',
    history: histTo([['SCHEDULED', 'CAMP', at(-31, 9)]]),
    nutrition: nutrition('Giữ 50 kg tới tuần thi đấu; đạm 1,8 g/kg; không cắt nước sớm.'),
    requirements: [
      { code: 'HEALTH_CERT', label: 'Giấy khám sức khỏe', required: true, status: 'CONFIRMED', issued_on: day(-35), valid_until: day(145), validity_days: 180, source: 'PRESET', updated_by_id: R, confirmed_by_id: S.thu.user, confirmed_at: at(-34, 10) },
      { code: 'INSURANCE', label: 'Bảo hiểm thi đấu', required: true, status: 'PROVIDED', issued_on: day(-20), valid_until: day(345), validity_days: 365, source: 'PRESET', updated_by_id: R },
      { code: 'FEDERATION_REG', label: 'Đăng ký thi đấu với liên đoàn / ban tổ chức', required: true, status: 'MISSING', validity_days: 365, source: 'PRESET' }] });
  await bout('kenji', { event: 'Lotus Fight Night 19', venue: 'Nhà thi đấu Phú Thọ, TP.HCM', opponent: 'Sơn Mai', wc: '65', limit: 65, status: 'CAMP', plan: 'kenji',
    weighIn: at(23, 8), boutAt: at(24, 20), created: at(-26, 10), notes: 'Trận đồng chính 3 hiệp × 5 phút.',
    history: histTo([['SCHEDULED', 'CAMP', at(-24, 9)]]),
    analysis: analysis({ profile: profile('ALL_ROUND', 'ORTHODOX', 9, 3, 'Băng hình 3 trận gần nhất', 171, 175), observations: obsUpcoming, tactics: tacticsUpcoming }),
    nutrition: nutrition('Thâm hụt 300 kcal/ngày; đạm 2 g/kg; 3 lít nước/ngày. Không cắt nước trước tuần thi đấu.') });
  await bout('aigerim', { event: 'Lotus Fight Night 20', venue: 'Nhà thi đấu Phú Thọ, TP.HCM', opponent: 'Daria Volkova', wc: '56', limit: 56, status: 'CAMP', plan: 'aigerim',
    weighIn: at(36, 10), boutAt: at(37, 20), created: at(-9, 10), notes: 'Trận chính thức 3 hiệp × 5 phút.',
    history: histTo([['SCHEDULED', 'CAMP', at(-3, 9)]]),
    nutrition: nutrition('Thâm hụt 300–400 kcal/ngày; đạm 2 g/kg; tinh bột quanh buổi tập; 3–4 lít nước/ngày.') });

  // ── đình chỉ ──
  await ins('suspensions', { fighter_id: F.khoa.id, bout_id: khoaBout.id, reason: 'KO', starts_on: day(-38), ends_on: day(-9), loss_of_consciousness: 'UNDER_1_MIN', blocked_session_types: ['SPARRING', 'GRAPPLING'], requires_clearance: true, created_by_id: R, issued_by: 'CLUB', created_at: at(-39, 21, 10) });
  await ins('suspensions', { fighter_id: F.long.id, bout_id: longBout.id, reason: 'TKO', starts_on: day(-11), ends_on: day(18), loss_of_consciousness: 'NONE', blocked_session_types: ['SPARRING', 'GRAPPLING'], requires_clearance: true, created_by_id: R, issued_by: 'CLUB', created_at: at(-12, 21) });
  await ins('suspensions', { fighter_id: F.tuan.id, reason: 'MANDATORY_REST', starts_on: day(-11), ends_on: day(-5), blocked_session_types: ['SPARRING', 'GRAPPLING', 'HEAVY_BAG', 'PAD_WORK'], requires_clearance: false, created_by_id: R, issued_by: 'CLUB', created_at: at(-12, 20, 30) });
  bump('suspensions', 3);

  // ── video: đổi tên, Minh có một video HLV đã duyệt ──
  await q(`update videos set title = 'Bao cát — 19/11/2026', created_at = $2, recorded_at = $3 where id = $1`, [KEEP_VIDEOS.kenjiBag, at(0, 7, 40), at(0, 7, 15)]);
  await q(`update videos set title = 'Bao cát — 20/10/2026', recorded_at = $2 where id = $1`, [KEEP_VIDEOS.minhBag20, at(-30, 9, 30)]);
  await q(`update videos set title = 'Bao cát — 25/10/2026', recorded_at = $2 where id = $1`, [KEEP_VIDEOS.minhBag25, at(-25, 9, 30)]);
  await q(`update videos set title = 'Đánh bóng — 17/11/2026', recorded_at = $2 where id = $1`, [KEEP_VIDEOS.minhShadow, at(-2, 7, 20)]);
  const minhAnalysis = await one(`select id from ai_analyses where video_id = $1 and status = 'COMPLETED' order by created_at desc limit 1`, [KEEP_VIDEOS.minhBag20]);
  if (minhAnalysis) {
    await ins('coach_reviews', { analysis_id: minhAnalysis.id, coach_id: S.rafael.coach, review_text: 'Đòn thẳng tay sau tốt, xoay hông đủ. Cần thu tay về che cằm nhanh hơn sau mỗi đòn.', technique_rating: 7, overrides_ai: false, revision: 1, created_at: at(-29, 18) });
    bump('coach_reviews');
  }

  // ── tuyển sinh ──
  for (const g of GUESTS) {
    const app = await ins('fighter_applications', { guest_user_id: guestUsers[g.email], email: g.email, first_name: g.first, last_name: g.last, date_of_birth: g.dob, weight_class: g.wc, nationality: 'Vietnam', contact_phone: g.phone, training_background: g.training, competition_background: g.comp, motivation: g.motivation, status: g.status, submitted_at: g.submitted, created_at: g.submitted });
    bump('fighter_applications');
    if (!g.coach) continue;
    const asg = await ins('fighter_application_coach_assignments', { application_id: app.id, coach_id: S[g.coach].coach, assigned_by_id: admin.id, starts_at: plusMin(g.submitted, 900), created_at: plusMin(g.submitted, 900) });
    const pass = g.conclusion === 'PASS';
    const asm = await ins('fighter_application_assessments', { application_id: app.id, assignment_id: asg.id, coach_id: S[g.coach].coach, conclusion: g.conclusion,
      summary: pass ? 'Kỹ thuật đứng đòn tốt, thể lực đạt 5 hiệp × 3 phút, thái độ tập nghiêm túc.' : 'Chưa có nền tảng kỹ thuật, thể lực chưa đạt 3 hiệp. Đề nghị tập lớp cơ bản 3 tháng rồi đăng ký lại.',
      criteria: J([
        { criterionName: 'Thể lực: đấm bao liên tục', method: 'Đấm bao 5 hiệp × 3 phút, nghỉ 1 phút', unit: 'hiệp', value: pass ? 5 : 2, observation: pass ? 'Giữ nhịp đều tới hiệp cuối' : 'Đuối từ hiệp 2', note: null },
        { criterionName: 'Kỹ thuật đứng đòn', method: 'Ôm đích với HLV, chấm thang 1–5', unit: 'điểm', value: pass ? 4 : 2, observation: pass ? 'Phối hợp tay tốt, giữ thủ' : 'Hạ tay khi ra đòn', note: null },
        { criterionName: 'Thái độ tập', method: 'HLV quan sát cả buổi, chấm thang 1–5', unit: 'điểm', value: pass ? 5 : 4, observation: 'Nghe hướng dẫn, tập nghiêm túc', note: null }]),
      assessed_at: g.assessedAt, created_at: g.assessedAt });
    if (g.decision) await ins('fighter_application_decisions', { application_id: app.id, assessment_id: asm.id, admin_id: admin.id, decision: g.decision, reason: 'Đạt đánh giá đầu vào, đủ suất lớp thi đấu tháng 12.', decided_at: g.decidedAt, created_at: g.decidedAt });
  }

  // ── thông báo ──
  const notify = async (userId, type, title, message, target, created, read = false, data) => {
    await ins('notifications', { user_id: userId, type, title, message, payload: J({ v: 1, ...(data ? { data } : {}), ...(target ? { target } : {}) }), is_read: read, read_at: read ? plusMin(created, 30) : null, created_at: created });
    bump('notifications');
  };
  await notify(F.minh.user, 'TRAINING_PLAN_ACTIVATED', 'Training plan active', 'A training plan assigned to you is now active.', { id: plans.minh.id, type: 'TRAINING_PLAN' }, at(-17, 20), true);
  await notify(F.minh.user, 'TRAINING_SESSION_SCHEDULED', 'Training session scheduled', 'A new training session was scheduled.', null, at(-4, 20, 15), true, { location: 'Lotus Combat – Sàn chính', scheduledAt: at(-1, 9) });
  await notify(F.minh.user, 'TRAINING_SESSION_SCHEDULED', 'Training session scheduled', 'A new training session was scheduled.', null, at(-1, 20, 15), false, { location: 'Lotus Combat – Khu vật', scheduledAt: at(1, 9) });
  await notify(F.huy.user, 'COACH_ASSIGNMENT_STARTED', 'Training Coach assigned', 'A training Coach was assigned to you.', null, at(-18, 10), true, { startsAt: at(-18, 10) });
  await notify(S.rafael.user, 'COACH_ASSIGNMENT_STARTED', 'New Fighter assigned', 'You were assigned as training Coach for a Fighter. The Fighter appears in your roster from the assignment start.', { id: F.vy.id, type: 'FIGHTER' }, at(-4, 10), false, { startsAt: at(-4, 10) });
  await notify(S.rafael.user, 'COACH_ASSIGNMENT_STARTED', 'New Fighter assigned', 'You were assigned as training Coach for a Fighter. The Fighter appears in your roster from the assignment start.', { id: F.huy.id, type: 'FIGHTER' }, at(-18, 10), true, { startsAt: at(-18, 10) });
  await notify(S.thu.user, 'FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED', 'Baseline examination needed', 'A Fighter assigned to you has no baseline examination yet.', { id: F.vy.id, type: 'FIGHTER' }, at(-4, 10, 5), false);

  // Trạng thái y tế tóm tắt, cùng luật với deriveMedicalStatus.
  const status = { minh: 'HEALTHY', kenji: 'HEALTHY', aigerim: 'HEALTHY', lucas: 'RECOVERY', bao: 'HEALTHY', nhung: 'HEALTHY', long: 'HEALTHY', khoa: 'NOT_CLEARED', tam: 'NOT_CLEARED', huy: 'HEALTHY', tuan: 'HEALTHY', vy: 'NOT_CLEARED' };
  for (const [k, s] of Object.entries(status)) await q(`update fighters set current_medical_status = $2 where id = $1`, [F[k].id, s]);
}

// ── kiểm tra khoá ngoại sau khi chạy ─────────────────────────────────────────
async function checkForeignKeys() {
  const fks = await q(`
    select con.conname, con.conrelid::regclass::text t, con.confrelid::regclass::text ft,
      (select array_agg(a.attname::text order by k.ord) from unnest(con.conkey) with ordinality k(att, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.att) cc,
      (select array_agg(a.attname::text order by k.ord) from unnest(con.confkey) with ordinality k(att, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.att) pc
    from pg_constraint con join pg_namespace n on n.oid = con.connamespace where con.contype = 'f' and n.nspname = 'public'`);
  const bad = [];
  for (const fk of fks) {
    const cc = fk.cc.map((x) => `c."${x}"`), pc = fk.pc.map((x) => `p."${x}"`);
    const [{ n }] = await q(`select count(*)::int n from ${fk.t} c where ${cc.map((x) => `${x} is not null`).join(' and ')} and not exists (select 1 from ${fk.ft} p where (${pc.join(',')}) = (${cc.join(',')}))`);
    if (n) bad.push(`${fk.t}.${fk.conname}: ${n}`);
  }
  if (bad.length) throw new Error(`Khoá ngoại hỏng:\n  ${bad.join('\n  ')}`);
}

// ── main ─────────────────────────────────────────────────────────────────────
await c.connect();
const ctx = { authIds: {} };
try {
  if (APPLY) console.log(`Sao lưu: ${await backup()}`);
  ctx.scatTemplate = await one(`select scat6_form_version, scat6_responses, scat6_scoring_version, scat6_scores from medical_examination_details where examination_type = 'BASELINE' and scat6_responses is not null order by created_at desc limit 1`);
  if (!ctx.scatTemplate) throw new Error('Không tìm thấy mẫu SCAT6');
  const newEmails = [...NEW_FIGHTERS.map((f) => f.email), ...GUESTS.map((g) => g.email)];
  const missing = (await q(`select unnest($1::text[]) e except select email from users`, [newEmails])).map((r) => r.e);
  ctx.authIds = await prepareAuthUsers(missing);
  await q('begin');
  await cleanup(ctx);
  await seed(ctx);
  await checkForeignKeys();
  await q(APPLY ? 'commit' : 'rollback');
  console.log(APPLY ? 'ĐÃ COMMIT.' : 'Chạy thử xong, đã ROLLBACK (chưa ghi gì).');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  if (APPLY && ctx.junkAuthIds?.length) {
    let ok = 0;
    for (const id of ctx.junkAuthIds) {
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) ok++;
    }
    console.log(`  auth users @test.invalid đã xoá: ${ok}/${ctx.junkAuthIds.length}`);
  }
} catch (e) {
  await q('rollback').catch(() => {});
  console.error('LỖI, đã ROLLBACK:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
