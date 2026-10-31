#!/usr/bin/env node
// T-040 B: demo data through the HTTP API only (no SQL). Fake people, @example.com.
// Usage: node scripts/demo-seed.mjs [--dry-run] [--with-ai]
// Env: DEMO_SEED_API_URL, DEMO_SEED_USER_PASSWORD, and DEMO_SEED_TOKEN
//      or DEMO_SEED_ADMIN_EMAIL + DEMO_SEED_ADMIN_PASSWORD.
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Pure part (exported for tests)
// ---------------------------------------------------------------------------

const ACADEMY_OFFSET_MS = 7 * 3_600_000; // UTC+7, no daylight saving
const DAY_MS = 86_400_000;
export const CUTOFF = { hour: 22, minute: 30 }; // fighter 6 fights today at 23:00
export const RULESET_NAME = 'MMA – VMMAF 2021';
export const WEIGHT_CLASS = '70';
export const STATUS_ORDER = ['SCHEDULED', 'CAMP', 'FIGHT_WEEK', 'WEIGHED_IN', 'COMPLETED'];

export const academyDate = (d) => new Date(d.getTime() + ACADEMY_OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const academyInstant = (date, hour, minute = 0) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + (hour * 60 + minute) * 60_000 - ACADEMY_OFFSET_MS);
export const isWriteMethod = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());

export function isPastCutoff(now) {
  const minutes = Math.floor(((now.getTime() + ACADEMY_OFFSET_MS) % DAY_MS) / 60_000);
  return minutes >= CUTOFF.hour * 60 + CUTOFF.minute;
}

const round1 = (n) => Math.round(n * 10) / 10;
const range = (from, to, step) => {
  const out = [];
  for (let i = from; i <= to; i += step) out.push(i);
  return out;
};

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
    profile: { firstName, lastName, dateOfBirth: `199${n}-0${n}-1${n}`, weightClass: 'LIGHTWEIGHT', gym: 'Học viện demo' },
  });
  const campPlan = (title, startOffset) => ({ title, phase: 'fight_camp', startDate: addDays(today, startOffset) });

  return {
    today,
    coach: {
      email: 't040.coach@example.com',
      profile: { firstName: 'Huấn', lastName: 'Luyện Demo', isHeadCoach: false, specialization: 'MMA' },
    },
    fighters: [
      {
        ...fighter(1, 'An', 'Camp Demo'),
        stage: 'CAMP',
        // Every other day, last weight 3 days ago: gaps in the last week, grey track.
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
        stage: 'FIGHT_WEEK',
        // Daily until 2 days ago; latest 75.8 kg is 7.7 % above 70 kg, just under the 8 % red line.
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
        stage: 'WEIGHED_IN',
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
        stage: 'SUSPENDED',
        measurements: series([-10, -7, -4, -1], 72.4, 71.8),
        // Created before the suspension and inside its window.
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
        stage: 'READY',
        measurements: series([-6, -3, -1], 71.5, 71),
      },
      {
        ...fighter(6, 'Phong', 'Báo Cáo Demo'),
        stage: 'COMPLETED',
        measurements: series(range(-29, -1, 2), 76, 71),
        plan: campPlan('T-040 demo · camp võ sĩ 6', -30),
        bout: {
          eventName: 'T-040 Demo · Võ sĩ 6 · Thua KO',
          opponentName: 'Đối thủ Demo 6',
          weighInAt: oneHourAgo,
          boutAt: at(0, 23), // today, academy time; the backend refuses a result before the bout date
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
          // The MMA ruleset has no suspension rule, so the backend requires the days.
          result: { result: 'LOSS', method: 'KO', resultRound: 2, knockedDown: true, lossOfConsciousness: 'UNDER_1_MIN', suspensionDays: 30, notes: 'Dữ liệu demo' },
          withAiTactics: true,
        },
      },
    ],
  };
}

export function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run'), withAi: argv.includes('--with-ai') };
}

export function missingEnv(env) {
  const missing = [];
  if (!env.DEMO_SEED_API_URL) missing.push('DEMO_SEED_API_URL');
  if (!env.DEMO_SEED_TOKEN) {
    if (!env.DEMO_SEED_ADMIN_EMAIL) missing.push('DEMO_SEED_ADMIN_EMAIL (hoặc DEMO_SEED_TOKEN)');
    if (!env.DEMO_SEED_ADMIN_PASSWORD) missing.push('DEMO_SEED_ADMIN_PASSWORD (hoặc DEMO_SEED_TOKEN)');
  }
  if (!env.DEMO_SEED_USER_PASSWORD) missing.push('DEMO_SEED_USER_PASSWORD');
  return missing;
}

/** Response bodies differ per endpoint: `items`, `data`, `suggestions`, `rounds` or a bare array. */
const listOf = (body) =>
  Array.isArray(body) ? body : (body?.items ?? body?.data ?? body?.suggestions ?? body?.rounds ?? []);

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function createClient({ baseUrl, fetchImpl, dryRun, out, stats }) {
  return async function call(method, path, { token, body, as, label } = {}) {
    const write = isWriteMethod(method);
    const line = `${method} ${path} [${as}]${label ? ` ${label}` : ''}`;
    if (dryRun) {
      if (!write) return {};
      out(line);
      if (!path.startsWith('/auth/')) stats.created++;
      const id = `<${(label ?? 'id').split(' ')[0]}>`;
      return { id, profile: { id }, session: { accessToken: 'dry-run' } };
    }
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = json?.error?.code ?? json?.code ?? '';
      const err = new Error(`${line} -> HTTP ${response.status} ${code}`.trim());
      err.status = response.status;
      err.code = code;
      throw err;
    }
    if (write) {
      out(line);
      if (!path.startsWith('/auth/')) stats.created++;
    }
    return json?.data;
  };
}

export async function run({ argv = [], env = {}, fetch: fetchImpl = globalThis.fetch, now = new Date(), out = console.log, err = console.error } = {}) {
  const { dryRun, withAi } = parseArgs(argv);
  if (isPastCutoff(now)) {
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
  const call = createClient({
    baseUrl: (env.DEMO_SEED_API_URL ?? '').replace(/\/+$/, ''),
    fetchImpl,
    dryRun,
    out,
    stats,
  });
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

    const coachId = await ensureUser('COACH', plan.coach, 'coach');
    let coachSession;
    try {
      coachSession = await call('POST', '/auth/login', {
        as: 'coach',
        body: { email: plan.coach.email, password: env.DEMO_SEED_USER_PASSWORD },
      });
    } catch (e) {
      if (e?.status === 401 || String(e?.message ?? e).includes('HTTP 401')) {
        throw new Error('coach demo exists with a different password');
      }
      throw e;
    }
    const C = { token: coachSession?.session?.accessToken, as: 'coach' };

    const ruleset = dryRun
      ? { id: '<rulesetId>' }
      : listOf(await call('GET', '/competition-rulesets', C)).find((r) => r.name === RULESET_NAME);
    if (!ruleset) throw new Error(`Không thấy ruleset "${RULESET_NAME}" (migration 024).`);

    for (const f of plan.fighters) {
      const fighterId = await ensureUser('FIGHTER', f, `${f.key}.fighterId`);

      const assignments = listOf(await call('GET', `/fighters/${fighterId}/coaches`, A));
      if (assignments.some((a) => a.coachId === coachId && a.endsAt === null)) found();
      else await call('POST', `/fighters/${fighterId}/coaches`, { ...A, label: f.key, body: { coachId } });

      const measured = await call('GET', `/fighters/${fighterId}/measurements?limit=1`, A);
      if ((measured?.total ?? 0) > 0) found();
      else
        for (const m of f.measurements)
          await call('POST', `/fighters/${fighterId}/measurements`, {
            ...A,
            label: `${f.key} ${m.weightKg}kg`,
            body: { weightKg: m.weightKg, measurementContext: 'TRAINING', measuredAt: m.measuredAt },
          });

      if (f.sessions) {
        const sessions = listOf(await call('GET', `/training-sessions?fighterId=${fighterId}&limit=100`, C));
        for (const s of f.sessions) {
          if (sessions.some((x) => x.title === s.title)) found();
          else await call('POST', '/training-sessions', { ...C, label: `${f.key} ${s.sessionType} ${s.scheduledAt}`, body: { fighterId, coachId, roundCount: 0, ...s } });
        }
      }

      if (f.suspension) {
        const existing = listOf(await call('GET', `/suspensions?fighterId=${fighterId}&limit=100`, C));
        // R28 on the server already moves the blocked SCHEDULED sessions on create; the script never calls conflicts/apply.
        if (existing.some((s) => s.clearedAt === null && s.status !== 'ENDED')) found();
        else await call('POST', '/suspensions', { ...C, label: f.key, body: { fighterId, ...f.suspension } });
      }

      if (f.bout) await seedBout({ call, C, f, fighterId, coachId, ruleset, withAi, dryRun, found, err });
    }
  } catch (error) {
    err(String(error?.message ?? error));
    out(`created=${stats.created} existing=${stats.existing}`);
    return 1;
  }
  out(`created=${stats.created} existing=${stats.existing}`);
  return 0;
}

async function seedBout({ call, C, f, fighterId, coachId, ruleset, withAi, dryRun, found, err }) {
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
        weightClassCode: WEIGHT_CLASS,
        weighInAt: b.weighInAt,
        boutAt: b.boutAt,
        ...(b.scheduledRounds ? { scheduledRounds: b.scheduledRounds } : {}),
      },
    });
    bout = { ...created, status: 'SCHEDULED' };
  }
  const id = bout.id;
  const at = (s) => STATUS_ORDER.indexOf(bout.status) === STATUS_ORDER.indexOf(s);
  const step = async (path, body, next) => {
    await call('POST', `/bouts/${id}/${path}`, { ...C, label: f.key, ...(body ? { body } : {}) });
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
    const detail = dryRun ? {} : await call('GET', `/bouts/${id}`, C);
    if (detail?.opponentAnalysis?.observations?.length) found();
    else await call('PUT', `/bouts/${id}/opponent-analysis`, { ...C, label: f.key, body: b.analysis });
  }
  // AI only on request, only while the bout is open (PRE_BOUT_TACTICS refuses a final bout), and only once.
  if (b.withAiTactics && withAi) {
    const saved = dryRun ? [] : listOf(await call('GET', `/bouts/${id}/ai/suggestions`, C));
    const hasOk = saved.some((s) => s.status === 'OK');
    if (hasOk) {
      found();
    } else if (open) {
      await call('POST', `/bouts/${id}/ai/tactics`, { ...C, label: f.key });
    } else {
      err('AI skipped: bout already completed; run the first seed with --with-ai');
    }
  }

  if (target >= 3 && at('FIGHT_WEEK')) await step('weigh-in', b.weighIn, 'WEIGHED_IN');

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
