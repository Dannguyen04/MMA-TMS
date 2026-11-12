#!/usr/bin/env node
// T-040 B / T-066: demo data through the HTTP API only (no SQL). Fake people, @example.com.
// Usage: node scripts/demo-seed.mjs [--dry-run] [--with-ai] [--stage early] [--only clearance]
//   --stage early (alias --only clearance): fighters f7–f10; run exactly the day before the main run (D−1).
// Env: DEMO_SEED_API_URL, DEMO_SEED_TOKEN (or DEMO_SEED_ADMIN_EMAIL + DEMO_SEED_ADMIN_PASSWORD),
//      DEMO_SEED_COACH_EMAIL, DEMO_SEED_COACH_PASSWORD,
//      DEMO_SEED_DOCTOR_EMAIL, DEMO_SEED_DOCTOR_PASSWORD, DEMO_SEED_USER_PASSWORD.
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Pure part
// ---------------------------------------------------------------------------

const ACADEMY_OFFSET_MS = 7 * 3_600_000; // UTC+7, no daylight saving
const DAY_MS = 86_400_000;
const CUTOFF = { hour: 22, minute: 30 }; // fighter 6 fights today at 23:00
const RULESET_NAME = 'MMA – VMMAF 2021';
const AIBA_RULESET_NAME = 'Boxing nghiệp dư – AIBA (tham khảo)';
const WEIGHT_CLASS = '70';
const STATUS_ORDER = ['SCHEDULED', 'CAMP', 'FIGHT_WEEK', 'WEIGHED_IN', 'COMPLETED'];

export const academyDate = (d) => new Date(d.getTime() + ACADEMY_OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const academyInstant = (date, hour, minute = 0) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + (hour * 60 + minute) * 60_000 - ACADEMY_OFFSET_MS);
export const isWriteMethod = (m) => m !== 'GET';

function isPastCutoff(now) {
  const minutes = Math.floor(((now.getTime() + ACADEMY_OFFSET_MS) % DAY_MS) / 60_000);
  return minutes >= CUTOFF.hour * 60 + CUTOFF.minute;
}

const round1 = (n) => Math.round(n * 10) / 10;
const range = (a, b, s) => Array.from({ length: (b - a) / s + 1 }, (_, i) => a + i * s);

/** Builds the whole data set from `now`; nothing here touches the network. */
export function buildPlan(now) {
  const today = academyDate(now);
  const at = (offset, hour, minute = 0) => academyInstant(addDays(today, offset), hour, minute).toISOString();
  const series = (offsets, fromKg, toKg) =>
    offsets.map((o, i) => ({
      measuredAt: at(o, 7),
      weightKg: round1(fromKg + ((toKg - fromKg) * i) / Math.max(1, offsets.length - 1)),
    }));
  const oneHourAgo = new Date(Math.floor((now.getTime() - 3_600_000) / 60_000) * 60_000).toISOString();
  const fighter = (n, firstName, lastName) => ({
    key: `f${n}`,
    email: `t040.fighter${n}@example.com`,
    profile: { firstName, lastName, dateOfBirth: `1995-01-${String(n).padStart(2, '0')}`, weightClass: 'LIGHTWEIGHT', gym: 'Học viện demo' },
  });
  const campPlan = (title, startOffset) => ({ title, phase: 'fight_camp', startDate: addDays(today, startOffset) });

  return {
    today,
    fighters: [
      {
        ...fighter(1, 'An', 'Camp Demo'),
        measurements: series(range(-27, -3, 2), 78, 75.6),
        plan: campPlan('T-040 demo · camp võ sĩ 1', -28),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 1 · Đang camp',
          opponentName: 'Đối thủ Demo 1',
          weighInAt: at(21, 8),
          boutAt: at(22, 19),
          target: 'CAMP',
        },
      },
      {
        ...fighter(2, 'Bình', 'Tuần Thi Demo'),
        measurements: series(range(-34, -2, 1), 80, 75.8),
        plan: campPlan('T-040 demo · camp võ sĩ 2', -35),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 2 · Tuần thi đấu',
          opponentName: 'Đối thủ Demo 2',
          weighInAt: at(3, 8),
          boutAt: at(4, 19),
          target: 'FIGHT_WEEK',
        },
      },
      {
        ...fighter(3, 'Cường', 'Vừa Cân Demo'),
        measurements: series(range(-41, -1, 3), 79, 71.2),
        plan: campPlan('T-040 demo · camp võ sĩ 3', -42),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 3 · Vừa cân',
          opponentName: 'Đối thủ Demo 3',
          weighInAt: oneHourAgo,
          boutAt: at(1, 19),
          target: 'WEIGHED_IN',
          weighIn: { weightKg: 69.8, hydrationCheck: 'NOT_APPLICABLE' },
        },
      },
      {
        ...fighter(4, 'Dũng', 'Đình Chỉ Demo'),
        measurements: series([-10, -7, -4, -1], 72.4, 71.8),
        sessions: [
          { title: 'T-040 demo · sparring 1', sessionType: 'SPARRING', scheduledAt: at(2, 18) },
          { title: 'T-040 demo · hồi phục', sessionType: 'RECOVERY', scheduledAt: at(3, 9) },
          { title: 'T-040 demo · sparring 2', sessionType: 'SPARRING', scheduledAt: at(5, 18) },
        ],
        suspension: {
          reason: 'MANDATORY_REST',
          days: 14,
          startsOn: today,
          blockedSessionTypes: ['SPARRING', 'GRAPPLING', 'PAD_WORK'],
        },
      },
      {
        ...fighter(5, 'Em', 'Sẵn Sàng Demo'),
        measurements: series([-6, -3, -1], 71.5, 71),
      },
      {
        ...fighter(6, 'Phong', 'Báo Cáo Demo'),
        measurements: series(range(-29, -1, 2), 76, 71),
        plan: campPlan('T-040 demo · camp võ sĩ 6', -30),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 6 · Thua KO',
          opponentName: 'Đối thủ Demo 6',
          weighInAt: oneHourAgo,
          boutAt: at(0, 23),
          scheduledRounds: 3,
          target: 'COMPLETED',
          weighIn: { weightKg: 69.9, hydrationCheck: 'NOT_APPLICABLE' },
          analysis: {
            profile: { wins: 9, losses: 2, draws: 0, stance: 'SOUTHPAW', style: 'STRIKER', heightCm: 178, reachCm: 183, source: 'Dữ liệu giả cho demo' },
            observations: [
              { id: 'o1', kind: 'STRENGTH', text: 'Tay trái thẳng mạnh khi đối phương lùi thẳng', evidenceNote: 'Ghi chú giả: 3 trận gần nhất', confidence: 'REPEATED' },
              { id: 'o2', kind: 'OPENING', text: 'Hạ tay phải sau cú đá vòng cầu', evidenceNote: 'Ghi chú giả', confidence: 'ONCE' },
              { id: 'o3', kind: 'HABIT', text: 'Lùi về góc trái khi bị ép', evidenceNote: 'Ghi chú giả', confidence: 'REPEATED' },
            ],
            tactics: [
              { id: 't1', text: 'Di chuyển sang phải, tránh trục tay trái', round: null, observationIds: ['o1'], sessionIds: [] },
              { id: 't2', text: 'Phản đòn tay phải sau cú đá vòng cầu', round: 2, observationIds: ['o2'], sessionIds: [] },
            ],
          },
          rounds: [
            {
              roundNo: 1,
              body: {
                tacticMarks: { t1: 'EFFECTIVE', t2: 'NOT_USED' },
                observationMarks: { o1: 'SEEN', o2: 'NOT_SEEN' },
                selfScore: 'CLOSE',
                knockdownsAgainst: 0,
                stunned: false,
                note: 'Hiệp thăm dò',
                nextRoundPlan: {
                  focusTacticIds: ['t2'],
                  addedTactics: [],
                  instructions: [{ code: 'USE_TACTIC', tacticId: 't2' }, { code: 'SAFETY_CHECK' }],
                },
              },
            },
            {
              roundNo: 2,
              body: {
                tacticMarks: { t2: 'INEFFECTIVE' },
                observationMarks: { o1: 'SEEN' },
                selfScore: 'LOSS',
                knockdownsAgainst: 1,
                stunned: true,
                note: 'Bị knock-out cuối hiệp 2',
              },
            },
          ],
          result: { result: 'LOSS', method: 'KO', resultRound: 2, knockedDown: true, lossOfConsciousness: 'UNDER_1_MIN', suspensionDays: 30, notes: 'Dữ liệu demo' },
        },
      },
      {
        ...fighter(7, 'Giang', 'Chờ Xác Nhận Demo'),
        stage: 'early',
        measurements: [],
        suspension: { reason: 'MEDICAL', days: 1, startsOn: today },
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 7 · Chờ xác nhận tập lại',
          opponentName: 'Đối thủ Demo 7',
          weighInAt: at(13, 8),
          boutAt: at(14, 19),
          target: 'SCHEDULED',
        },
      },
      {
        ...fighter(8, 'Hải', 'Tập Lại Demo'),
        stage: 'early',
        hasMainClear: true,
        suspension: { reason: 'KO', days: 1, requiresClearance: true, startsOn: today },
        clearanceNote: 'HLV xác nhận, không có xác nhận y tế',
      },
      {
        ...fighter(9, 'Khoa', 'Theo Bậc Demo'),
        stage: 'early',
        suspension: { reason: 'MEDICAL', issuedBy: 'CLUB', days: 14, startsOn: today },
        endEarly: { note: 'Bác sĩ Thu xác nhận đủ điều kiện tập lại sớm' },
      },
      {
        ...fighter(10, 'Lâm', 'Hết Hạn Demo'),
        stage: 'early',
        suspension: { reason: 'DQ', days: 1, requiresClearance: false, startsOn: today },
      },
      {
        ...fighter(11, 'Mai', 'Kết Thúc Sớm Demo'),
        suspension: { reason: 'MEDICAL', issuedBy: 'CLUB', days: 14, startsOn: today },
        examAfterSuspension: { reason: 'Khám đánh giá sau đình chỉ y tế' },
      },
      {
        ...fighter(12, 'Nam', 'Ban Tổ Chức Demo'),
        suspension: { reason: 'MEDICAL', issuedBy: 'ORGANIZER', issuerReference: 'QĐ 12/BTC – Giải MMA mở rộng TP.HCM', days: 30, startsOn: today },
      },
      {
        ...fighter(13, 'Oanh', 'Chờ Khám Demo'),
        suspension: { reason: 'MEDICAL', issuedBy: 'CLUB', days: 14, startsOn: today },
        reviewRequest: { reason: 'HLV yêu cầu bác sĩ kiểm tra lại chấn thương' },
      },
      {
        ...fighter(14, 'Phúc', 'Hồ Sơ Demo'),
        plan: campPlan('T-040 demo · camp võ sĩ 14', -10),
        bout: {
          rulesetName: AIBA_RULESET_NAME,
          weightClassCode: '71',
          eventName: 'T-040 Demo · Võ sĩ 14 · Thiếu hồ sơ',
          opponentName: 'Đối thủ Demo 14',
          weighInAt: at(5, 8),
          boutAt: at(6, 19),
          target: 'CAMP',
        },
      },
      {
        ...fighter(15, 'Quân', 'Cân Đỏ Demo'),
        measurements: series(range(-14, -1, 1), 80, 77),
        plan: campPlan('T-040 demo · camp võ sĩ 15', -25),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 15 · Cân đỏ',
          opponentName: 'Đối thủ Demo 15',
          weighInAt: at(2, 8),
          boutAt: at(3, 19),
          target: 'FIGHT_WEEK',
        },
      },
      {
        ...fighter(16, 'Sơn', 'Trượt Cân Demo'),
        plan: campPlan('T-040 demo · camp võ sĩ 16', -30),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 16 · Trượt cân',
          opponentName: 'Đối thủ Demo 16',
          weighInAt: oneHourAgo,
          boutAt: at(1, 19),
          target: 'WEIGHED_IN',
          weighIn: { weightKg: 71.2, hydrationCheck: 'NOT_APPLICABLE' },
          catchweight: { catchweightKg: 72, note: 'BTC chấp nhận 72 kg' },
        },
      },
      {
        ...fighter(17, 'Tùng', 'Huỷ Trận Demo'),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 17 · Huỷ trận',
          opponentName: 'Đối thủ Demo 17',
          weighInAt: at(20, 8),
          boutAt: at(21, 19),
          target: 'CANCELLED',
          cancel: { reason: 'Đối thủ rút' },
        },
      },
    ],
  };
}

function parseArgs(argv) {
  const stageIdx = argv.indexOf('--stage');
  const stage = stageIdx >= 0 ? argv[stageIdx + 1] ?? '' : undefined;
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] ?? '' : undefined;

  const allowedFlags = new Set(['--dry-run', '--with-ai', '--stage', '--only']);
  const unknown = argv.find((a, j) => {
    if (stageIdx >= 0 && j === stageIdx + 1) return false;
    if (onlyIdx >= 0 && j === onlyIdx + 1) return false;
    return !allowedFlags.has(a);
  });
  return { dryRun: argv.includes('--dry-run'), withAi: argv.includes('--with-ai'), stage, only, unknown };
}

function missingEnv(env) {
  const missing = [];
  if (!env.DEMO_SEED_API_URL) missing.push('DEMO_SEED_API_URL');
  if (!env.DEMO_SEED_TOKEN) {
    if (!env.DEMO_SEED_ADMIN_EMAIL) missing.push('DEMO_SEED_ADMIN_EMAIL (hoặc DEMO_SEED_TOKEN)');
    if (!env.DEMO_SEED_ADMIN_PASSWORD) missing.push('DEMO_SEED_ADMIN_PASSWORD (hoặc DEMO_SEED_TOKEN)');
  }
  if (!env.DEMO_SEED_COACH_EMAIL) missing.push('DEMO_SEED_COACH_EMAIL');
  if (!env.DEMO_SEED_COACH_PASSWORD) missing.push('DEMO_SEED_COACH_PASSWORD');
  if (!env.DEMO_SEED_DOCTOR_EMAIL) missing.push('DEMO_SEED_DOCTOR_EMAIL');
  if (!env.DEMO_SEED_DOCTOR_PASSWORD) missing.push('DEMO_SEED_DOCTOR_PASSWORD');
  if (!env.DEMO_SEED_USER_PASSWORD) missing.push('DEMO_SEED_USER_PASSWORD');
  return missing;
}

/** Response bodies differ per endpoint: `items`, `data`, `suggestions`, `rounds` or a bare array. */
const listOf = (body) =>
  Array.isArray(body) ? body : (body?.items ?? body?.data ?? body?.suggestions ?? body?.rounds ?? []);

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function run({ argv = [], env = {}, fetch: fetchImpl = globalThis.fetch, now = new Date(), out = console.log, err = console.error } = {}) {
  const { dryRun, withAi, stage: rawStage, only, unknown } = parseArgs(argv);
  if (unknown !== undefined) {
    err(`Tham số "${unknown}" không hợp lệ. Tham số cho phép: --dry-run, --with-ai, --stage early, --only clearance`);
    return 1;
  }
  if (only !== undefined && only !== 'clearance') {
    err(`--only "${only}" không hợp lệ. Giá trị cho phép: clearance`);
    return 1;
  }
  if (rawStage !== undefined && rawStage !== 'early') {
    err(`--stage "${rawStage}" không hợp lệ. Giá trị cho phép: early`);
    return 1;
  }
  const effectiveStage = rawStage ?? (only === 'clearance' ? 'early' : undefined);

  if (!effectiveStage && isPastCutoff(now)) {
    const msg = `Đã quá ${CUTOFF.hour}:${CUTOFF.minute} giờ học viện (UTC+7): trận của võ sĩ 6 xếp lúc 23:00 hôm nay sẽ không kịp. Chạy lại trước ${CUTOFF.hour}:${CUTOFF.minute}.`;
    if (!dryRun) {
      err(msg);
      return 1;
    }
    out(`Cảnh báo: ${msg}`);
  }
  if (!dryRun) {
    const missing = missingEnv(env);
    if (missing.length) {
      err(`Thiếu biến môi trường: ${missing.join(', ')}`);
      return 1;
    }
  }

  const stats = { created: 0, existing: 0 };
  const baseUrl = (env.DEMO_SEED_API_URL ?? '').replace(/\/+$/, '');
  const call = async (method, path, { token, body, as, label } = {}) => {
    const write = isWriteMethod(method);
    const line = `${method} ${path} [${as}]${label ? ` ${label}` : ''}`;
    let data;
    if (dryRun) {
      if (!write) return {};
      const id = `<${(label ?? 'id').split(' ')[0]}>`;
      data = { id, profile: { id }, session: { accessToken: 'dry-run' } };
    } else {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body && JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error(`${line} -> HTTP ${response.status} ${json?.error?.code ?? json?.code ?? ''}`.trim()), { status: response.status });
      }
      data = json?.data;
    }
    if (write) {
      out(line);
      if (!path.startsWith('/auth/')) stats.created++;
    }
    return data;
  };
  const plan = buildPlan(now);
  if (dryRun) out(`Dry-run: không gửi request nào. Các request ghi sẽ gửi khi DB rỗng (ngày học viện ${plan.today}):`);

  try {
    let admin = env.DEMO_SEED_TOKEN;
    if (!admin) {
      const session = await call('POST', '/auth/login', {
        as: 'admin',
        body: { email: env.DEMO_SEED_ADMIN_EMAIL, password: env.DEMO_SEED_ADMIN_PASSWORD },
      });
      admin = session?.session?.accessToken;
    }
    const A = { token: admin, as: 'admin' };
    const found = () => stats.existing++;

    const coachEmail = env.DEMO_SEED_COACH_EMAIL ?? 'rafael.costa@lotus-combat.test';
    let coachId;
    let coachSession;
    if (!dryRun) {
      const coachUser = listOf(await call('GET', `/users?search=${encodeURIComponent(coachEmail)}&role=COACH`, A)).find((u) => u.email === coachEmail);
      if (!coachUser) {
        err(`Không thấy HLV với email "${coachEmail}".`);
        return 1;
      }
      coachId = coachUser.profile.id;
      coachSession = await call('POST', '/auth/login', {
        as: 'coach',
        body: { email: coachEmail, password: env.DEMO_SEED_COACH_PASSWORD },
      });
    } else {
      coachId = '<coachId>';
      coachSession = await call('POST', '/auth/login', {
        as: 'coach',
        body: { email: coachEmail, password: 'dry-run' },
      });
    }
    const C = { token: coachSession?.session?.accessToken, as: 'coach' };

    const doctorEmail = env.DEMO_SEED_DOCTOR_EMAIL ?? 'thu.le@lotus-combat.test';
    let doctorId;
    let doctorSession;
    if (!dryRun) {
      const doctorUser = listOf(await call('GET', `/users?search=${encodeURIComponent(doctorEmail)}&role=DOCTOR`, A)).find((u) => u.email === doctorEmail);
      if (!doctorUser) {
        err(`Không thấy bác sĩ với email "${doctorEmail}".`);
        return 1;
      }
      doctorId = doctorUser.profile.id;
      doctorSession = await call('POST', '/auth/login', {
        as: 'doctor',
        body: { email: doctorEmail, password: env.DEMO_SEED_DOCTOR_PASSWORD },
      });
    } else {
      doctorId = '<doctorId>';
      doctorSession = await call('POST', '/auth/login', {
        as: 'doctor',
        body: { email: doctorEmail, password: 'dry-run' },
      });
    }
    const D = { token: doctorSession?.session?.accessToken, as: 'doctor' };

    const rulesets = dryRun
      ? [{ id: '<rulesetId>', name: RULESET_NAME }, { id: '<aibaRulesetId>', name: AIBA_RULESET_NAME }]
      : listOf(await call('GET', '/competition-rulesets', C));

    const ensureUser = async (role, person, label) => {
      const q = new URLSearchParams({ search: person.email, role });
      const hit = listOf(await call('GET', `/users?${q}`, A)).find((u) => u.email === person.email);
      if (hit) return found(), hit.profile.id;
      const created = await call('POST', '/users', {
        ...A,
        label: `${label} ${person.email}`,
        body: { user: { email: person.email, password: env.DEMO_SEED_USER_PASSWORD, role, profile: person.profile } },
      });
      return created.profile.id;
    };

    const targetFighters = effectiveStage === 'early'
      ? plan.fighters.filter((x) => x.stage === 'early')
      : plan.fighters;

    for (const f of targetFighters) {
      // In real main run, fighters needing early data (f8, f9) are checked; warn and skip if early wasn't run
      if (!dryRun && !effectiveStage && f.stage === 'early') {
        const existingUser = listOf(await call('GET', `/users?search=${f.email}&role=FIGHTER`, A)).find((u) => u.email === f.email);
        if (!existingUser) {
          err(`Võ sĩ ${f.key} (${f.profile.lastName} ${f.profile.firstName}) cần chạy --stage early hôm trước.`);
          continue;
        }
        if (f.hasMainClear) {
          const fid = existingUser.profile.id;
          const existingSusp = listOf(await call('GET', `/suspensions?fighterId=${fid}&limit=100`, C));
          const ko = existingSusp.find((s) => s.reason === 'KO');
          if (!ko) {
            err(`Võ sĩ ${f.key} (${f.profile.lastName} ${f.profile.firstName}) cần chạy --stage early hôm trước.`);
            continue;
          }
          if (ko.clearedAt !== null) {
            found();
          } else {
            if (ko.status !== 'AWAITING_CLEARANCE') {
              err(`Võ sĩ ${f.key} (${f.profile.lastName} ${f.profile.firstName}) cần chạy --stage early đúng hôm trước.`);
              continue;
            }
            await call('POST', `/suspensions/${ko.id}/clear`, { ...C, label: f.key, body: { clearanceNote: f.clearanceNote } });
          }
        }
        continue;
      }

      const fighterId = await ensureUser('FIGHTER', f, `${f.key}.fighterId`);

      const coachAssignments = listOf(await call('GET', `/fighters/${fighterId}/coaches`, A));
      if (coachAssignments.some((a) => a.coachId === coachId && a.endsAt === null)) found();
      else await call('POST', `/fighters/${fighterId}/coaches`, { ...A, label: f.key, body: { coachId } });

      const doctorAssignments = listOf(await call('GET', `/fighters/${fighterId}/doctors`, A));
      if (doctorAssignments.some((a) => a.doctorId === doctorId && a.endsAt === null)) found();
      else await call('POST', `/fighters/${fighterId}/doctors`, { ...A, label: f.key, body: { doctorId } });

      // Medical baseline + training eligibility + clearance
      const dossier = await call('GET', `/fighters/${fighterId}/medical`, D);
      const currentTraining = dossier?.currentExaminations?.training;
      const activeClearances = listOf(dossier?.activeClearances);
      const hasCurrentClearance = currentTraining && activeClearances.some(
        (c) => c.examinationId === currentTraining.id && c.clearanceType === 'TRAINING'
      );

      if (hasCurrentClearance) {
        found();
      } else {
        const onboardingExamDate = addDays(plan.today, -1) + 'T08:00:00.000Z';
        const existingExams = listOf(await call('GET', `/fighters/${fighterId}/medical-examinations?limit=100`, D));
        const hasBaseline = existingExams.some((e) => (e.details?.examinationType ?? e.examinationType) === 'BASELINE');

        if (hasBaseline) {
          found();
        } else {
          await call('POST', `/fighters/${fighterId}/medical-examinations`, {
            ...D,
            label: `${f.key}.baseline`,
            body: {
              scope: 'TRAINING',
              decision: 'ELIGIBLE',
              examinedAt: onboardingExamDate,
              reason: 'Khám tổng quát đầu vào',
              examinationType: 'BASELINE',
              vitals: { weightKg: 70, restingHeartRate: 60, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, temperatureC: 36.6, spo2Pct: 98, hydration: 'GOOD' },
              assessments: [{ area: 'Musculoskeletal', result: 'NORMAL', note: null }],
              scat6: { status: 'NOT_ADMINISTERED', formVersion: 'SCAT6-2023-EN', reason: 'Baseline assessment deferred' },
            },
          });
        }

        let trainingExam = currentTraining;
        if (trainingExam && hasBaseline) {
          found();
        } else {
          trainingExam = await call('POST', `/fighters/${fighterId}/medical-examinations`, {
            ...D,
            label: `${f.key}.trainingExam`,
            body: {
              scope: 'TRAINING',
              decision: 'ELIGIBLE',
              examinedAt: onboardingExamDate,
              reason: 'Khám định kỳ đủ điều kiện tập',
            },
          });
        }

        await call('POST', `/fighters/${fighterId}/medical-clearances`, {
          ...D,
          label: f.key,
          body: { examinationId: trainingExam.id, clearanceType: 'TRAINING' },
        });
      }

      if (f.measurements) {
        const measured = await call('GET', `/fighters/${fighterId}/measurements?limit=1`, A);
        if ((measured?.total ?? 0) > 0) found();
        else
          for (const m of f.measurements)
            await call('POST', `/fighters/${fighterId}/measurements`, {
              ...A,
              label: `${f.key} ${m.weightKg}kg`,
              body: { weightKg: m.weightKg, measurementContext: 'TRAINING', measuredAt: m.measuredAt },
            });
      }

      if (f.sessions) {
        const sessions = listOf(await call('GET', `/training-sessions?fighterId=${fighterId}&limit=100`, C));
        for (const s of f.sessions) {
          if (sessions.some((x) => x.title === s.title)) found();
          else await call('POST', '/training-sessions', { ...C, label: `${f.key} ${s.sessionType} ${s.scheduledAt}`, body: { fighterId, coachId, roundCount: 0, ...s } });
        }
      }

      let createdSuspensionId;
      let matchedSuspension;
      if (f.suspension) {
        const existing = listOf(await call('GET', `/suspensions?fighterId=${fighterId}&limit=100`, C));
        const matched = existing.find((s) => s.reason === f.suspension.reason && (s.issuedBy ?? 'CLUB') === (f.suspension.issuedBy ?? 'CLUB'));
        if (matched) {
          found();
          createdSuspensionId = matched.id;
          matchedSuspension = matched;
        } else {
          const susp = await call('POST', '/suspensions', { ...C, label: `${f.key}.suspensionId`, body: { fighterId, ...f.suspension } });
          createdSuspensionId = susp.id;
          matchedSuspension = susp;
        }
      }

      if (dryRun && f.hasMainClear) {
        await call('POST', `/suspensions/<${f.key}.suspensionId>/clear`, { ...C, label: f.key, body: { clearanceNote: f.clearanceNote } });
      }

      if (f.endEarly) {
        const suspId = createdSuspensionId ?? `<${f.key}.suspensionId>`;
        const existingSusp = listOf(await call('GET', `/suspensions?fighterId=${fighterId}&limit=100`, C)).find((s) => s.id === suspId);
        if (existingSusp?.clearedAt !== null && existingSusp?.status === 'ENDED') {
          found();
        } else {
          const examinedAt = new Date(now.getTime() - 60_000).toISOString();
          const earlyExam = await call('POST', `/fighters/${fighterId}/medical-examinations`, {
            ...D,
            label: `${f.key}.endEarlyExam`,
            body: { scope: 'TRAINING', decision: 'ELIGIBLE', examinedAt, reason: 'Khám kết thúc đình chỉ sớm' },
          });
          await call('POST', `/fighters/${fighterId}/medical-clearances`, {
            ...D,
            label: `${f.key}.endEarlyClearance`,
            body: { examinationId: earlyExam.id, clearanceType: 'TRAINING' },
          });
          await call('POST', `/suspensions/${suspId}/end-early`, {
            ...D,
            label: f.key,
            body: { examinationId: earlyExam.id, note: f.endEarly.note },
          });
        }
      }

      if (f.examAfterSuspension) {
        const suspStartsOn = matchedSuspension?.startsOn ?? f.suspension?.startsOn;
        const exams = listOf(await call('GET', `/fighters/${fighterId}/medical-examinations?limit=100`, D));
        const afterSusp = exams.find((e) => e.scope === 'TRAINING' && academyDate(new Date(e.examinedAt)) >= suspStartsOn && e.reason === f.examAfterSuspension.reason);
        if (afterSusp) {
          found();
          const dossier = await call('GET', `/fighters/${fighterId}/medical`, D);
          const activeClearances = listOf(dossier?.activeClearances);
          if (activeClearances.some((c) => c.examinationId === afterSusp.id && c.clearanceType === 'TRAINING')) {
            found();
          } else {
            await call('POST', `/fighters/${fighterId}/medical-clearances`, {
              ...D,
              label: `${f.key}.examAfterSuspClearance`,
              body: { examinationId: afterSusp.id, clearanceType: 'TRAINING' },
            });
          }
        } else {
          const examinedAt = new Date(now.getTime() - 60_000).toISOString();
          const exam = await call('POST', `/fighters/${fighterId}/medical-examinations`, {
            ...D,
            label: `${f.key}.examAfterSusp`,
            body: { scope: 'TRAINING', decision: 'ELIGIBLE', examinedAt, reason: f.examAfterSuspension.reason },
          });
          await call('POST', `/fighters/${fighterId}/medical-clearances`, {
            ...D,
            label: `${f.key}.examAfterSuspClearance`,
            body: { examinationId: exam.id, clearanceType: 'TRAINING' },
          });
        }
      }

      if (f.reviewRequest) {
        const requests = listOf(await call('GET', `/fighters/${fighterId}/medical-review-requests`, C));
        if (requests.some((r) => r.status === 'OPEN')) found();
        else {
          await call('POST', `/fighters/${fighterId}/medical-review-requests`, {
            ...C,
            label: f.key,
            body: f.reviewRequest,
          });
        }
      }

      if (f.bout) {
        const rsName = f.bout.rulesetName ?? RULESET_NAME;
        const boutRuleset = rulesets.find((r) => r.name === rsName);
        if (!boutRuleset) throw new Error(`Không thấy ruleset "${rsName}".`);
        await seedBout({ call, C, f, fighterId, coachId, ruleset: boutRuleset, withAi, found, err });
      }
    }
  } catch (error) {
    err(String(error?.message ?? error));
    out(`created=${stats.created} existing=${stats.existing}`);
    return 1;
  }
  out(`created=${stats.created} existing=${stats.existing}`);
  return 0;
}

async function seedBout({ call, C, f, fighterId, coachId, ruleset, withAi, found, err }) {
  const b = f.bout;
  const target = STATUS_ORDER.indexOf(b.target);
  let bout = listOf(await call('GET', `/bouts?fighterId=${fighterId}&limit=100`, C)).find((x) => x.eventName === b.eventName);
  if (bout) found();
  else {
    const created = await call('POST', '/bouts', {
      ...C,
      label: `${f.key}.boutId`,
      body: {
        fighterId,
        rulesetId: ruleset.id,
        eventName: b.eventName,
        opponentName: b.opponentName,
        weightClassCode: b.weightClassCode ?? WEIGHT_CLASS,
        weighInAt: b.weighInAt,
        boutAt: b.boutAt,
        scheduledRounds: b.scheduledRounds,
      },
    });
    bout = { ...created, status: 'SCHEDULED' };
  }
  const id = bout.id;
  const at = (s) => bout.status === s;
  const step = async (path, body, next) => {
    await call('POST', `/bouts/${id}/${path}`, { ...C, label: f.key, body });
    bout.status = next;
  };

  if (target >= 1 && at('SCHEDULED')) {
    const plans = listOf(await call('GET', `/training-plans?fighterId=${fighterId}&limit=100`, C));
    let planId = plans.find((p) => p.title === f.plan.title && !p.deletedAt)?.id;
    if (planId) found();
    else planId = (await call('POST', '/training-plans', { ...C, label: `${f.key}.planId`, body: { fighterId, coachId, ...f.plan } })).id;
    await step('camp', { trainingPlanId: planId }, 'CAMP');
  }
  if (target >= 2 && at('CAMP')) await step('fight-week', null, 'FIGHT_WEEK');

  const open = !['COMPLETED', 'CANCELLED'].includes(bout.status);
  if (b.analysis && open) {
    const detail = await call('GET', `/bouts/${id}`, C);
    if (detail?.opponentAnalysis?.observations?.length) found();
    else await call('PUT', `/bouts/${id}/opponent-analysis`, { ...C, label: f.key, body: b.analysis });
  }
  if (b.analysis && withAi) {
    const saved = listOf(await call('GET', `/bouts/${id}/ai/suggestions`, C));
    const hasOk = saved.some((s) => s.status === 'OK');
    if (hasOk) {
      found();
    } else if (open) {
      await call('POST', `/bouts/${id}/ai/tactics`, { ...C, label: f.key });
    } else {
      err('AI skipped: bout already completed; run the first seed with --with-ai');
    }
  }

  if (target >= 3) {
    if (bout.officialWeightKg !== null && bout.officialWeightKg !== undefined) {
      found();
    } else if (at('FIGHT_WEEK')) {
      await step('weigh-in', b.weighIn, b.catchweight ? 'FIGHT_WEEK' : 'WEIGHED_IN');
      if (b.catchweight) {
        bout.madeWeight = false;
        bout.officialWeightKg = String(b.weighIn.weightKg);
      }
    }
  }

  if (b.catchweight) {
    if (bout.catchweightKg !== null && bout.catchweightKg !== undefined) {
      found();
    } else if (at('FIGHT_WEEK') && bout.madeWeight === false) {
      await call('POST', `/bouts/${id}/catchweight`, { ...C, label: f.key, body: b.catchweight });
      bout.status = 'WEIGHED_IN';
      bout.madeWeight = true;
    }
  }

  if (b.cancel) {
    if (at('CANCELLED')) found();
    else await step('cancel', b.cancel, 'CANCELLED');
  }

  if (b.rounds && (at('WEIGHED_IN') || at('COMPLETED'))) {
    const recorded = new Set(listOf(await call('GET', `/bouts/${id}/rounds`, C)).map((r) => r.roundNo));
    for (const r of b.rounds) {
      if (recorded.has(r.roundNo)) found();
      else await call('PUT', `/bouts/${id}/rounds/${r.roundNo}`, { ...C, label: f.key, body: r.body });
    }
  }
  if (target >= 4 && at('WEIGHED_IN')) await step('result', b.result, 'COMPLETED');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run({ argv: process.argv.slice(2), env: process.env });
}
