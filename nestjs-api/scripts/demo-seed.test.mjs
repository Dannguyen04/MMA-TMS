// T-040 B test cases S1-S18 & T-066 test cases T1-T19. Run: node --test scripts/demo-seed.test.mjs
// The fake API keeps real in-memory state between runs; nothing touches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { academyDate, addDays, buildPlan, isWriteMethod, run } from './demo-seed.mjs';

const BASE = 'http://fake.invalid';
const ENV = {
  DEMO_SEED_API_URL: BASE,
  DEMO_SEED_ADMIN_EMAIL: 'admin@example.com',
  DEMO_SEED_ADMIN_PASSWORD: 'not-a-real-password',
  DEMO_SEED_COACH_EMAIL: 'rafael.costa@lotus-combat.test',
  DEMO_SEED_COACH_PASSWORD: 'not-a-real-password',
  DEMO_SEED_DOCTOR_EMAIL: 'thu.le@lotus-combat.test',
  DEMO_SEED_DOCTOR_PASSWORD: 'not-a-real-password',
  DEMO_SEED_USER_PASSWORD: 'not-a-real-password',
};
const NOW = new Date('2026-11-03T03:00:00Z'); // 10:00 UTC+7
const DEMO_DAY = new Date('2026-11-17T02:00:00Z'); // D = 2026-11-17, 09:00 UTC+7
const DEMO_PREV_DAY = new Date('2026-11-16T02:00:00Z'); // D-1 = 2026-11-16

function createFakeApi(options = {}) {
  const { now = NOW } = options;
  let currentNow = now;
  const coachUser = {
    id: randomUUID(),
    email: 'rafael.costa@lotus-combat.test',
    role: 'COACH',
    profile: { id: randomUUID(), firstName: 'Rafael', lastName: 'Costa' },
  };
  const doctorUser = {
    id: randomUUID(),
    email: 'thu.le@lotus-combat.test',
    role: 'DOCTOR',
    profile: { id: randomUUID(), firstName: 'Thu', lastName: 'Lê' },
  };
  const db = {
    users: [coachUser, doctorUser],
    assignments: [],
    doctorAssignments: [],
    measurements: [],
    plans: [],
    sessions: [],
    suspensions: [],
    bouts: [],
    rounds: [],
    suggestions: [],
    examinations: [],
    clearances: [],
    reviewRequests: [],
    rulesets: [
      { id: randomUUID(), name: 'MMA – VMMAF 2021', sport: 'MMA' },
      { id: randomUUID(), name: 'Boxing nghiệp dư – AIBA (tham khảo)', sport: 'BOXING' },
    ],
  };
  const requests = [];
  const ok = (data, status = 200) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status });
  const fail = (status, code) => new Response(JSON.stringify({ success: false, error: { code } }), { status });
  const NEXT = {
    camp: ['SCHEDULED', 'CAMP'],
    'fight-week': ['CAMP', 'FIGHT_WEEK'],
    'weigh-in': ['FIGHT_WEEK', 'WEIGHED_IN'],
    result: ['WEIGHED_IN', 'COMPLETED'],
  };

  async function fetch(url, init = {}) {
    const u = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    const token = init.headers?.authorization?.replace('Bearer ', '');
    const path = u.pathname;
    const q = Object.fromEntries(u.searchParams);
    requests.push({ method, path, body, token });
    const route = `${method} ${path}`;
    let m;

    if (route === 'POST /auth/login') {
      if (body?.email === ENV.DEMO_SEED_COACH_EMAIL) return ok({ session: { accessToken: 'tok-coach' } });
      if (body?.email === ENV.DEMO_SEED_DOCTOR_EMAIL) return ok({ session: { accessToken: 'tok-doctor' } });
      if (body?.email === ENV.DEMO_SEED_ADMIN_EMAIL) return ok({ session: { accessToken: 'tok-admin' } });
      return ok({ session: { accessToken: 'tok' } });
    }
    if (!token) return fail(401, 'AUTHENTICATION_REQUIRED');

    if (route === 'GET /users') {
      const search = q.search ?? '';
      return ok({ items: db.users.filter((x) => x.email.includes(search) && (!q.role || x.role === q.role)) });
    }
    if (route === 'POST /users') {
      if (db.users.some((x) => x.email === body.user.email)) return fail(409, 'USER_ALREADY_EXISTS');
      const user = { id: randomUUID(), email: body.user.email, role: body.user.role, profile: { id: randomUUID(), ...body.user.profile } };
      db.users.push(user);
      return ok(user, 201);
    }
    if (route === 'GET /competition-rulesets') return ok(db.rulesets);

    if ((m = path.match(/^\/fighters\/([^/]+)\/coaches$/))) {
      if (method === 'GET') return ok(db.assignments.filter((a) => a.fighterId === m[1]));
      if (db.assignments.some((a) => a.fighterId === m[1] && a.coachId === body.coachId && a.endsAt === null)) return fail(409, 'COACH_ASSIGNMENT_ALREADY_ACTIVE');
      const a = { id: randomUUID(), fighterId: m[1], coachId: body.coachId, endsAt: null };
      db.assignments.push(a);
      return ok(a, 201);
    }

    if ((m = path.match(/^\/fighters\/([^/]+)\/doctors$/))) {
      if (method === 'GET') return ok(db.doctorAssignments.filter((a) => a.fighterId === m[1]));
      if (db.doctorAssignments.some((a) => a.fighterId === m[1] && a.doctorId === body.doctorId && a.endsAt === null)) return fail(409, 'DOCTOR_ASSIGNMENT_ALREADY_ACTIVE');
      const a = { id: randomUUID(), fighterId: m[1], doctorId: body.doctorId, startsAt: new Date().toISOString(), endsAt: null };
      db.doctorAssignments.push(a);
      return ok(a, 201);
    }

    if ((m = path.match(/^\/fighters\/([^/]+)\/medical$/))) {
      const exams = db.examinations.filter((e) => e.fighterId === m[1] && e.scope === 'TRAINING');
      const currentTraining = exams.at(-1) ?? null;
      const activeClearances = db.clearances.filter((c) => c.fighterId === m[1] && c.status === 'ACTIVE');
      const hasClearance = currentTraining && activeClearances.some((c) => c.examinationId === currentTraining.id && c.clearanceType === 'TRAINING');
      return ok({
        currentExaminations: { training: currentTraining, competition: null },
        activeClearances,
        eligibility: {
          training: { eligible: Boolean(hasClearance), scope: 'TRAINING' },
          competition: { eligible: false, scope: 'COMPETITION' },
        },
      });
    }

    if ((m = path.match(/^\/fighters\/([^/]+)\/medical-examinations$/))) {
      if (method === 'GET') return ok({ data: db.examinations.filter((e) => e.fighterId === m[1]) });
      if (new Date(body.examinedAt).getTime() > currentNow.getTime()) {
        return fail(400, 'EXAMINED_AT_FUTURE');
      }
      const { examinationType, vitals, assessments, scat6, ...rest } = body;
      const details = examinationType ? { examinationType, vitals, assessments, scat6 } : null;
      const exam = { id: randomUUID(), fighterId: m[1], doctorId: doctorUser.profile.id, ...rest, details };
      db.examinations.push(exam);
      return ok(exam, 201);
    }

    if ((m = path.match(/^\/fighters\/([^/]+)\/medical-clearances$/))) {
      if (options.failClearanceForFighter) {
        const u = db.users.find((x) => x.email === options.failClearanceForFighter);
        if (u?.profile?.id === m[1] && !options.clearanceFailed) {
          options.clearanceFailed = true;
          return fail(500, 'INTERNAL_ERROR');
        }
      }
      const fighterExams = db.examinations.filter((e) => e.fighterId === m[1] && e.scope === 'TRAINING');
      const latestExam = fighterExams.at(-1);
      const targetExam = db.examinations.find((e) => e.id === body.examinationId);
      if (!targetExam || targetExam.id !== latestExam?.id || targetExam.decision === 'NOT_ELIGIBLE') {
        return fail(409, 'CLEARANCE_NOT_DERIVABLE');
      }
      const cl = { id: randomUUID(), fighterId: m[1], ...body, status: 'ACTIVE' };
      db.clearances.push(cl);
      return ok(cl, 201);
    }

    if ((m = path.match(/^\/fighters\/([^/]+)\/medical-review-requests$/))) {
      if (method === 'GET') return ok({ data: db.reviewRequests.filter((r) => r.fighterId === m[1]) });
      const req = { id: randomUUID(), fighterId: m[1], ...body, status: 'OPEN' };
      db.reviewRequests.push(req);
      return ok(req, 201);
    }

    if ((m = path.match(/^\/fighters\/([^/]+)\/measurements$/))) {
      const rows = db.measurements.filter((x) => x.fighterId === m[1]);
      if (method === 'GET') return ok({ data: rows.slice(0, Number(q.limit ?? 20)), total: rows.length });
      const row = { id: randomUUID(), fighterId: m[1], ...body };
      db.measurements.push(row);
      return ok(row, 201);
    }

    for (const [name, key] of [['/training-plans', 'plans'], ['/training-sessions', 'sessions']]) {
      if (path !== name) continue;
      if (method === 'GET') {
        const rows = db[key].filter((x) => !q.fighterId || x.fighterId === q.fighterId);
        return ok({ data: rows, total: rows.length });
      }
      const row = { id: randomUUID(), deletedAt: null, ...body };
      db[key].push(row);
      return ok(row, 201);
    }

    if (path === '/suspensions') {
      if (method === 'GET') {
        const today = academyDate(currentNow);
        const rows = db.suspensions
          .filter((x) => !q.fighterId || x.fighterId === q.fighterId)
          .map((s) => {
            let status;
            if (s.clearedAt !== null) status = 'ENDED';
            else if (today < s.startsOn) status = 'UPCOMING';
            else if (today <= s.endsOn) status = 'ACTIVE';
            else status = s.requiresClearance ? 'AWAITING_CLEARANCE' : 'ENDED';
            return { ...s, status };
          });
        return ok({ data: rows, total: rows.length });
      }
      const today = academyDate(currentNow);
      if (body.startsOn && body.startsOn < today) return fail(400, 'STARTS_ON_BEFORE_TODAY');
      if (body.issuedBy === 'ORGANIZER') {
        if (!body.issuerReference) return fail(400, 'ORGANIZER_REQUIRES_ISSUER_REFERENCE');
        if (body.reason !== 'MEDICAL') return fail(400, 'ORGANIZER_REQUIRES_MEDICAL');
      }
      const startsOn = body.startsOn ?? today;
      const row = {
        id: randomUUID(),
        fighterId: body.fighterId,
        reason: body.reason,
        days: body.days,
        startsOn,
        endsOn: addDays(startsOn, body.days - 1),
        issuedBy: body.issuedBy ?? 'CLUB',
        issuerReference: body.issuerReference ?? null,
        requiresClearance: body.requiresClearance ?? ['KO', 'TKO', 'MEDICAL'].includes(body.reason),
        status: 'ACTIVE',
        clearedAt: null,
        clearanceNote: null,
        earlyEndExaminationId: null,
        deletedAt: null,
        ...body,
      };
      db.suspensions.push(row);
      return ok(row, 201);
    }

    if ((m = path.match(/^\/suspensions\/([^/]+)\/clear$/))) {
      if (token !== 'tok-coach' && token !== 'tok-doctor') return fail(403, 'FORBIDDEN');
      const susp = db.suspensions.find((x) => x.id === m[1]);
      if (!susp) return fail(404, 'SUSPENSION_NOT_FOUND');
      const today = academyDate(currentNow);
      let status;
      if (susp.clearedAt !== null) status = 'ENDED';
      else if (today < susp.startsOn) status = 'UPCOMING';
      else if (today <= susp.endsOn) status = 'ACTIVE';
      else status = susp.requiresClearance ? 'AWAITING_CLEARANCE' : 'ENDED';
      if (status !== 'AWAITING_CLEARANCE') {
        return fail(409, 'SUSPENSION_NOT_AWAITING_CLEARANCE');
      }
      susp.clearedAt = new Date().toISOString();
      susp.clearanceNote = body.clearanceNote;
      susp.status = 'ENDED';
      return ok(susp);
    }

    if ((m = path.match(/^\/suspensions\/([^/]+)\/end-early$/))) {
      const susp = db.suspensions.find((x) => x.id === m[1]);
      if (!susp) return fail(404, 'SUSPENSION_NOT_FOUND');
      const today = academyDate(currentNow);
      let status;
      if (susp.clearedAt !== null) status = 'ENDED';
      else if (today < susp.startsOn) status = 'UPCOMING';
      else if (today <= susp.endsOn) status = 'ACTIVE';
      else status = susp.requiresClearance ? 'AWAITING_CLEARANCE' : 'ENDED';
      if (susp.reason !== 'MEDICAL' || status !== 'ACTIVE') {
        return fail(409, 'SUSPENSION_EARLY_END_NOT_ELIGIBLE');
      }
      if (susp.issuedBy === 'ORGANIZER') {
        if (token !== 'tok-coach' && token !== 'tok-doctor') return fail(403, 'FORBIDDEN');
        if (!body.liftReference) return fail(400, 'LIFT_REFERENCE_REQUIRED');
      } else {
        if (token !== 'tok-doctor') return fail(403, 'FORBIDDEN');
        if (!body.examinationId) return fail(400, 'EXAMINATION_ID_REQUIRED');
        const exam = db.examinations.find((e) => e.id === body.examinationId);
        if (!exam) return fail(404, 'EXAMINATION_NOT_FOUND');
        if (exam.doctorId !== doctorUser.profile.id) return fail(409, 'OTHER_DOCTOR');
        if (academyDate(new Date(exam.examinedAt)) < susp.startsOn) return fail(409, 'BEFORE_SUSPENSION');
        susp.earlyEndExaminationId = body.examinationId;
      }
      susp.clearedAt = new Date().toISOString();
      susp.status = 'ENDED';
      susp.clearanceNote = body.note;
      return ok(susp);
    }

    if (route === 'GET /bouts') return ok({ data: db.bouts.filter((x) => !q.fighterId || x.fighterId === q.fighterId), hasNextPage: false, nextCursor: null });
    if (route === 'POST /bouts') {
      const bout = { id: randomUUID(), status: 'SCHEDULED', opponentAnalysis: {}, ...body };
      db.bouts.push(bout);
      return ok(bout, 201);
    }

    if ((m = path.match(/^\/bouts\/([^/]+)(?:\/(.+))?$/))) {
      const bout = db.bouts.find((x) => x.id === m[1]);
      if (!bout) return fail(404, 'BOUT_NOT_FOUND');
      const sub = m[2];
      if (!sub && method === 'GET') return ok(bout);
      if (method === 'POST' && sub === 'weigh-in') {
        if (bout.status !== 'FIGHT_WEEK') return fail(409, 'BOUT_INVALID_TRANSITION');
        bout.officialWeightKg = String(body.weightKg);
        const limit = bout.weightClassCode === '71' ? 71 : 70;
        bout.madeWeight = body.weightKg <= limit;
        bout.status = bout.madeWeight ? 'WEIGHED_IN' : 'FIGHT_WEEK';
        return ok(bout);
      }
      if (method === 'POST' && NEXT[sub] && sub !== 'weigh-in') {
        const [from, to] = NEXT[sub];
        if (bout.status !== from) return fail(409, 'BOUT_INVALID_TRANSITION');
        bout.status = to;
        if (sub === 'camp') bout.trainingPlanId = body.trainingPlanId;
        return ok(bout);
      }
      if (sub === 'catchweight' && method === 'POST') {
        if (options.failCatchweightOnce && !options.catchweightFailed) {
          options.catchweightFailed = true;
          return fail(500, 'INTERNAL_ERROR');
        }
        if (bout.status !== 'FIGHT_WEEK' || bout.madeWeight !== false || !bout.officialWeightKg) {
          return fail(409, 'BOUT_WEIGH_IN_NOT_FAILED');
        }
        bout.catchweightKg = body.catchweightKg;
        bout.catchweightNote = body.note;
        bout.madeWeight = true;
        bout.status = 'WEIGHED_IN';
        return ok(bout);
      }
      if (sub === 'cancel' && method === 'POST') {
        if (bout.status === 'CANCELLED') return fail(409, 'BOUT_ALREADY_CANCELLED');
        bout.status = 'CANCELLED';
        bout.cancelReason = body.reason;
        return ok(bout);
      }
      if (sub === 'opponent-analysis' && method === 'PUT') {
        if (['COMPLETED', 'CANCELLED'].includes(bout.status)) return fail(409, 'BOUT_NOT_EDITABLE');
        bout.opponentAnalysis = body;
        return ok({ opponentAnalysis: body });
      }
      if (sub === 'rounds' && method === 'GET') return ok({ scheduledRounds: bout.scheduledRounds, rounds: db.rounds.filter((r) => r.boutId === bout.id) });
      if ((m = sub?.match(/^rounds\/(\d+)$/)) && method === 'PUT') {
        if (!['WEIGHED_IN', 'COMPLETED'].includes(bout.status)) return fail(409, 'BOUT_NOT_EDITABLE');
        db.rounds = db.rounds.filter((r) => !(r.boutId === bout.id && r.roundNo === Number(m[1])));
        db.rounds.push({ boutId: bout.id, roundNo: Number(m[1]), ...body });
        return ok({ roundNo: Number(m[1]) });
      }
      if (sub === 'ai/suggestions' && method === 'GET') return ok({ suggestions: db.suggestions.filter((s) => s.boutId === bout.id) });
      if (sub === 'ai/tactics' && method === 'POST') {
        const s = { id: randomUUID(), boutId: bout.id, kind: 'PRE_BOUT_TACTICS', status: 'OK' };
        db.suggestions.push(s);
        return ok({ suggestion: s });
      }
    }
    return fail(404, `FAKE_ROUTE_MISSING ${route}`);
  }

  return {
    fetch,
    db,
    requests,
    options,
    setNow: (n) => {
      currentNow = n;
    },
  };
}

async function runSeed(api, { argv = [], env = ENV, now = NOW } = {}) {
  const lines = [];
  const errors = [];
  if (api?.setNow) api.setNow(now);
  const code = await run({
    argv,
    env,
    now,
    fetch: api?.fetch ?? (() => assert.fail('fetch must not be called')),
    out: (l) => lines.push(l),
    err: (l) => errors.push(l),
  });
  return { code, stdout: lines.join('\n'), stderr: errors.join('\n') };
}

const writes = (requests) => requests.filter((r) => isWriteMethod(r.method));
const creatingWrites = (requests) => writes(requests).filter((r) => r.path !== '/auth/login');

// ---------------------------------------------------------------------------
// Existing cases S1-S18
// ---------------------------------------------------------------------------

test('S1: --dry-run sends no write request and prints every planned write', async () => {
  const api = createFakeApi();
  const { code, stdout } = await runSeed(api, { argv: ['--dry-run'] });
  assert.equal(code, 0);
  assert.equal(api.requests.length, 0);
  assert.match(stdout, /^POST \/users \[admin\]/m);
  assert.match(stdout, /^POST \/bouts \[coach\]/m);
  assert.match(stdout, /^POST \/bouts\/<f6\.boutId>\/result \[coach\]/m);
  assert.match(stdout, /^PUT \/bouts\/<f6\.boutId>\/rounds\/2 \[coach\]/m);
  assert.match(stdout, /^POST \/suspensions \[coach\]/m);
});

test('S2: two real runs on the same fake API, the second creates nothing', async () => {
  const api = createFakeApi();
  const first = await runSeed(api);
  assert.equal(first.code, 0, first.stderr);
  const m1 = first.stdout.match(/created=(\d+) existing=(\d+)/);
  assert.ok(m1, 'run 1 prints created/existing');
  assert.ok(Number(m1[1]) > 0);
  // 13 main fighters created + 2 existing accounts (Rafael, Thu) = 15
  assert.equal(api.db.users.length, 15);
  assert.equal(api.db.bouts.find((b) => b.eventName.includes('Võ sĩ 6')).status, 'COMPLETED');

  const before = api.requests.length;
  const second = await runSeed(api);
  assert.equal(second.code, 0, second.stderr);
  const m2 = second.stdout.match(/created=(\d+) existing=(\d+)/);
  assert.ok(m2, 'run 2 prints created/existing');
  assert.equal(Number(m2[1]), 0);
  assert.ok(Number(m2[2]) > 0);
  assert.deepEqual(creatingWrites(api.requests.slice(before)), []);
  assert.equal(api.db.users.length, 15);
});

test('S3: an existing fighter 2 user and bout are not created again, the rest is', async () => {
  const api = createFakeApi();
  const plan = buildPlan(NOW);
  const f2 = plan.fighters[1];
  const profileId = randomUUID();
  api.db.users.push({ id: randomUUID(), email: f2.email, role: 'FIGHTER', profile: { id: profileId } });
  api.db.bouts.push({ id: randomUUID(), fighterId: profileId, eventName: f2.bout.eventName, status: 'SCHEDULED', opponentAnalysis: {} });

  const { code, stderr } = await runSeed(api);
  assert.equal(code, 0, stderr);
  const posts = api.requests.filter((r) => r.method === 'POST');
  assert.ok(!posts.some((r) => r.path === '/users' && r.body.user.email === f2.email));
  assert.ok(!posts.some((r) => r.path === '/bouts' && r.body.eventName === f2.bout.eventName));
  assert.equal(api.db.users.length, 15);
  assert.equal(api.db.bouts.filter((b) => b.eventName === f2.bout.eventName).length, 1);
});

test('S4: every email in the plan ends with @example.com, for any now', () => {
  for (const iso of ['2026-11-03T03:00:00Z', '2026-12-31T16:59:00Z', '2027-02-28T23:00:00Z', '2030-06-15T12:00:00Z']) {
    const plan = buildPlan(new Date(iso));
    const emails = plan.fighters.map((f) => f.email);
    assert.equal(emails.length, 17);
    for (const e of emails) assert.match(e, /@example\.com$/);
  }
});

test('S5: missing URL or token exits non-zero, names the variable, sends nothing', async () => {
  for (const drop of [['DEMO_SEED_API_URL'], ['DEMO_SEED_ADMIN_EMAIL', 'DEMO_SEED_ADMIN_PASSWORD'], ['DEMO_SEED_COACH_EMAIL'], ['DEMO_SEED_DOCTOR_PASSWORD']]) {
    const env = { ...ENV };
    for (const k of drop) delete env[k];
    const { code, stderr } = await runSeed(null, { env });
    assert.notEqual(code, 0);
    for (const k of drop) assert.match(stderr, new RegExp(k));
  }
});

test('S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7)', () => {
  const plan = buildPlan(NOW);
  const today = academyDate(NOW);
  assert.equal(today, '2026-11-03');
  const [f1, f2, f3, , f5, f6] = plan.fighters;

  assert.equal(f1.bout.target, 'CAMP');
  const weighed = new Set(f1.measurements.map((m) => academyDate(new Date(m.measuredAt))));
  const lastWeek = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(today, -n));
  assert.ok(lastWeek.some((d) => !weighed.has(d)), 'fighter 1 has an empty day in the last 7 days');
  assert.ok(f1.measurements.length >= 7, 'fighter 1 has several weeks of weights');

  assert.equal(f2.bout.target, 'FIGHT_WEEK');
  const weighInDate = academyDate(new Date(f2.bout.weighInAt));
  assert.ok(today >= addDays(weighInDate, -7) && today <= weighInDate, 'today is in the fight week (7 days, MMA ruleset)');

  assert.equal(f3.bout.target, 'WEIGHED_IN');
  assert.ok(new Date(f3.bout.weighInAt) <= NOW && NOW < new Date(f3.bout.boutAt));

  assert.equal(f5.bout, undefined);
  assert.equal(f5.suspension, undefined);

  const boutAt = new Date(f6.bout.boutAt);
  assert.equal(academyDate(boutAt), today);
  assert.ok(boutAt > NOW);
});

test('S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing', async () => {
  const api = createFakeApi();
  const { code, stderr } = await runSeed(api, { now: new Date('2026-11-03T15:40:00Z') });
  assert.notEqual(code, 0);
  assert.match(stderr, /22:30/);
  assert.equal(api.requests.length, 0);
});

test('S8: without --with-ai no request goes to an /ai/ path', async () => {
  const api = createFakeApi();
  const { code, stderr } = await runSeed(api);
  assert.equal(code, 0, stderr);
  assert.deepEqual(api.requests.filter((r) => r.path.includes('/ai/')), []);
});

async function seedFighter6InFightWeek(api, status) {
  const f6 = buildPlan(NOW).fighters[5];
  const profileId = randomUUID();
  const boutId = randomUUID();
  api.db.users.push({ id: randomUUID(), email: f6.email, role: 'FIGHTER', profile: { id: profileId } });
  api.db.bouts.push({ id: boutId, fighterId: profileId, eventName: f6.bout.eventName, status: 'FIGHT_WEEK', opponentAnalysis: f6.bout.analysis });
  if (status) api.db.suggestions.push({ id: randomUUID(), boutId, kind: 'PRE_BOUT_TACTICS', status });
  return boutId;
}

async function noAiPostWhenOkSaved() {
  const api = createFakeApi();
  await seedFighter6InFightWeek(api, 'OK');
  const { code, stderr } = await runSeed(api, { argv: ['--with-ai'] });
  assert.equal(code, 0, stderr);
  assert.deepEqual(api.requests.filter((r) => r.method === 'POST' && r.path.includes('/ai/')), []);
  assert.ok(api.requests.some((r) => r.method === 'GET' && r.path.endsWith('/ai/suggestions')));
}

test('S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/', noAiPostWhenOkSaved);

test('S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics', async () => {
  const api = createFakeApi();
  const boutId = await seedFighter6InFightWeek(api, null);
  const { code, stderr } = await runSeed(api, { argv: ['--with-ai'] });
  assert.equal(code, 0, stderr);
  const aiPosts = api.requests.filter((r) => r.method === 'POST' && r.path.includes('/ai/'));
  assert.deepEqual(aiPosts.map((r) => r.path), [`/bouts/${boutId}/ai/tactics`]);
});

test('S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called', async () => {
  const f4 = buildPlan(NOW).fighters[3];
  const s = f4.suspension;
  const endsOn = addDays(s.startsOn, s.days - 1);
  const blocked = f4.sessions.filter((x) => s.blockedSessionTypes.includes(x.sessionType));
  assert.ok(blocked.length >= 1);
  for (const x of blocked) {
    const d = academyDate(new Date(x.scheduledAt));
    assert.ok(d >= s.startsOn && d <= endsOn, `${x.title} inside the suspension window`);
  }

  const api = createFakeApi();
  const { code, stderr } = await runSeed(api);
  assert.equal(code, 0, stderr);
  const fighterId = api.db.users.find((u) => u.email === f4.email).profile.id;
  const order = api.requests.filter((r) => r.method === 'POST' && r.body?.fighterId === fighterId).map((r) => r.path);
  const firstSuspension = order.indexOf('/suspensions');
  assert.ok(firstSuspension > 0);
  const blockedCreates = api.requests
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.method === 'POST' && r.path === '/training-sessions' && r.body.fighterId === fighterId && s.blockedSessionTypes.includes(r.body.sessionType));
  const suspensionAt = api.requests.findIndex((r) => r.method === 'POST' && r.path === '/suspensions' && r.body.fighterId === fighterId);
  assert.equal(blockedCreates.length, blocked.length);
  for (const r of blockedCreates) assert.ok(r.i < suspensionAt);
  assert.deepEqual(api.requests.filter((r) => r.path.includes('/conflicts/apply')), []);
});

test('S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0', async () => {
  const api = createFakeApi();
  const first = await runSeed(api);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(api.db.bouts.find((b) => b.eventName.includes('Võ sĩ 6')).status, 'COMPLETED');

  const before = api.requests.length;
  const second = await runSeed(api, { argv: ['--with-ai'] });
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stderr, /AI skipped: bout already completed; run the first seed with --with-ai/);
  assert.deepEqual(api.requests.slice(before).filter((r) => r.method === 'POST' && r.path.includes('/ai/')), []);
});

test('S13: --with-ai, API giả có sẵn một gợi ý status \'FAILED\' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/...', async () => {
  const api = createFakeApi();
  const boutId = await seedFighter6InFightWeek(api, 'FAILED');
  const { code, stderr } = await runSeed(api, { argv: ['--with-ai'] });
  assert.equal(code, 0, stderr);
  const aiPosts = api.requests.filter((r) => r.method === 'POST' && r.path.includes('/ai/'));
  assert.deepEqual(aiPosts.map((r) => r.path), [`/bouts/${boutId}/ai/tactics`]);
});

test('S14: --with-ai, API giả có sẵn gợi ý status \'OK\' → không gọi /ai/ (giống S9, giữ S9)', noAiPostWhenOkSaved);

test('S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  const { code, stderr } = await runSeed(api, { argv: ['--only', 'clearance'], now: DEMO_PREV_DAY });
  assert.equal(code, 0, stderr);

  const f7User = api.db.users.find((u) => u.email === 't040.fighter7@example.com');
  assert.ok(f7User, 'fighter 7 user created');
  const w = creatingWrites(api.requests);
  // Writes are only for early fighters (f7, f8, f9, f10)
  for (const r of w) {
    const isEarly = ['t040.fighter7', 't040.fighter8', 't040.fighter9', 't040.fighter10'].some((prefix) => {
      const u = api.db.users.find((x) => x.email.startsWith(prefix));
      if (!u) return false;
      const fid = u.profile.id;
      const suspIds = api.db.suspensions.filter((s) => s.fighterId === fid).map((s) => s.id);
      return JSON.stringify(r).includes(prefix) || r.path.includes(fid) || r.body?.fighterId === fid || suspIds.some((sid) => r.path.includes(sid));
    });
    assert.ok(isEarly, `unexpected write: ${r.method} ${r.path}`);
  }

  const before = api.requests.length;
  const second = await runSeed(api, { now: DEMO_DAY });
  assert.equal(second.code, 0, second.stderr);
  const again = creatingWrites(api.requests.slice(before));
  assert.ok(!again.some((r) => r.path === '/users' && r.body.user.email === 't040.fighter7@example.com'));
});

test('S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  const { code, stderr } = await runSeed(api, { now: DEMO_DAY });
  assert.equal(code, 0, stderr);
  const f7User = api.db.users.find((u) => u.email === 't040.fighter7@example.com');
  assert.ok(f7User, 'f7 created');
  const bout = api.db.bouts.find((b) => b.fighterId === f7User.profile.id);
  assert.equal(bout.status, 'SCHEDULED');
  const suspensions = api.db.suspensions.filter((s) => s.fighterId === f7User.profile.id);
  assert.equal(suspensions.length, 1);
  assert.equal(suspensions[0].reason, 'MEDICAL');
  assert.equal(suspensions[0].days, 1);
});

test('S16: --only somethingelse exits non-zero, names the allowed value, sends nothing', async () => {
  const api = createFakeApi();
  const { code, stderr } = await runSeed(api, { argv: ['--only', 'somethingelse'] });
  assert.notEqual(code, 0);
  assert.match(stderr, /clearance/);
  assert.equal(api.requests.length, 0);
});

test('S17: --dry-run --only=clearance exits non-zero, names the bad argument, sends nothing', async () => {
  const api = createFakeApi();
  const { code, stderr } = await runSeed(api, { argv: ['--dry-run', '--only=clearance'] });
  assert.notEqual(code, 0);
  assert.ok(stderr.includes('--only=clearance'), stderr);
  assert.equal(api.requests.length, 0);
});

test('S18: --bogus exits non-zero, names the bad argument, sends nothing', async () => {
  const api = createFakeApi();
  const { code, stderr } = await runSeed(api, { argv: ['--bogus'] });
  assert.notEqual(code, 0);
  assert.ok(stderr.includes('--bogus'), stderr);
  assert.equal(api.requests.length, 0);
});

// ---------------------------------------------------------------------------
// Ticket T-066 test cases T1-T19
// ---------------------------------------------------------------------------

test('T1: Chạy --stage early lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  const run1 = await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  assert.equal(run1.code, 0, run1.stderr);

  // Lần 1 chỉ ghi cho f7, f8, f9, f10
  const createdFighters = api.db.users.filter((u) => u.role === 'FIGHTER').map((u) => u.email);
  assert.deepEqual(createdFighters.sort(), [
    't040.fighter10@example.com',
    't040.fighter7@example.com',
    't040.fighter8@example.com',
    't040.fighter9@example.com',
  ]);

  const before = api.requests.length;
  const run2 = await runSeed(api, { now: DEMO_DAY });
  assert.equal(run2.code, 0, run2.stderr);

  // Lần 2 không tạo lại user nào của f7-f10
  const run2Writes = creatingWrites(api.requests.slice(before));
  const run2Users = run2Writes.filter((r) => r.path === '/users').map((r) => r.body.user.email);
  for (const n of [7, 8, 9, 10]) {
    assert.ok(!run2Users.includes(`t040.fighter${n}@example.com`));
  }

  // Có đúng một POST /suspensions/:id/clear cho f8
  const f8User = api.db.users.find((u) => u.email === 't040.fighter8@example.com');
  const f8Susp = api.db.suspensions.find((s) => s.fighterId === f8User.profile.id && s.reason === 'KO');
  const clears = run2Writes.filter((r) => r.method === 'POST' && r.path === `/suspensions/${f8Susp.id}/clear`);
  assert.equal(clears.length, 1);
  assert.equal(clears[0].body.clearanceNote, 'HLV xác nhận, không có xác nhận y tế');
});

test('T2: Chạy chính lúc D trên API rỗng (không chạy early)', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  const { code, stderr } = await runSeed(api, { now: DEMO_DAY });
  assert.equal(code, 0);

  // stderr nhắc từng võ sĩ f8 và f9 (hoặc nhóm early) cần --stage early hôm trước
  assert.match(stderr, /f8/);
  assert.match(stderr, /f9/);
  assert.match(stderr, /--stage early/);

  // Không có POST .../clear hay .../end-early nào
  const w = creatingWrites(api.requests);
  assert.ok(!w.some((r) => r.path.endsWith('/clear')));
  assert.ok(!w.some((r) => r.path.endsWith('/end-early')));

  // Các võ sĩ còn lại (f1-f6, f11-f17) vẫn được tạo
  for (const n of [1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 17]) {
    assert.ok(api.db.users.some((u) => u.email === `t040.fighter${n}@example.com`), `f${n} should exist`);
  }
});

test('T3: Chạy hai lần liên tiếp early (D−1) + chính (D), rồi chạy chính lần nữa', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const before = api.requests.length;
  const third = await runSeed(api, { now: DEMO_DAY });
  assert.equal(third.code, 0, third.stderr);

  // Lần cuối: không có request ghi nào; in created=0
  const thirdWrites = creatingWrites(api.requests.slice(before));
  assert.deepEqual(thirdWrites, []);
  assert.match(third.stdout, /created=0/);
});

test('T4: Lần chạy chính lúc D, đếm request theo vai trò', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });

  const before = api.requests.length;
  const res = await runSeed(api, { now: DEMO_DAY });
  assert.equal(res.code, 0, res.stderr);

  const mainRequests = api.requests.slice(before).filter((r) => isWriteMethod(r.method) && !r.path.startsWith('/auth/'));

  // Không có POST /users với role: 'COACH' hay 'DOCTOR'
  assert.ok(!mainRequests.some((r) => r.path === '/users' && ['COACH', 'DOCTOR'].includes(r.body?.user?.role)));

  for (const r of mainRequests) {
    if (['/bouts', '/suspensions', '/training-sessions', '/medical-review-requests'].some((p) => r.path.includes(p)) && !r.path.includes('/end-early')) {
      assert.equal(r.token, 'tok-coach', `Coach token expected for ${r.method} ${r.path}`);
    } else if (r.path.includes('/medical-examinations') || r.path.includes('/medical-clearances') || r.path.includes('/end-early')) {
      assert.equal(r.token, 'tok-doctor', `Doctor token expected for ${r.method} ${r.path}`);
    } else if (r.path.includes('/doctors') || r.path.includes('/coaches') || r.path === '/users' || r.path.includes('/measurements')) {
      assert.equal(r.token, 'tok-admin', `Admin token expected for ${r.method} ${r.path}`);
    }
  }
});

test('T5: Lần chạy chính lúc D: mỗi võ sĩ f1–f17', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const thu = api.db.users.find((u) => u.email === 'thu.le@lotus-combat.test');

  for (let n = 1; n <= 17; n++) {
    const u = api.db.users.find((x) => x.email === `t040.fighter${n}@example.com`);
    assert.ok(u, `f${n} user exists`);
    const fid = u.profile.id;

    // Đúng một phân công Thu còn hiệu lực
    const docs = api.db.doctorAssignments.filter((a) => a.fighterId === fid && a.doctorId === thu.profile.id && a.endsAt === null);
    assert.equal(docs.length, 1, `f${n} active Thu assignment`);

    // Có một phiếu BASELINE, một phiếu TRAINING ELIGIBLE, một clearance từ phiếu đó
    const exams = api.db.examinations.filter((e) => e.fighterId === fid);
    const baseline = exams.find((e) => (e.details?.examinationType ?? e.examinationType) === 'BASELINE');
    assert.ok(baseline, `f${n} BASELINE exam exists`);

    const training = exams.find((e) => e.scope === 'TRAINING' && e.decision === 'ELIGIBLE' && e.id !== baseline.id);
    assert.ok(training, `f${n} TRAINING ELIGIBLE exam exists`);

    const clearance = api.db.clearances.find((c) => c.fighterId === fid && c.examinationId === training.id);
    assert.ok(clearance, `f${n} clearance exists`);

    // Thứ tự: BASELINE -> TRAINING -> clearance
    const fPosts = api.requests.filter((r) => r.method === 'POST' && (r.body?.fighterId === fid || r.path.includes(fid))).map((r) => r.path);
    const bi = fPosts.findIndex((p) => p.includes('/medical-examinations'));
    const ti = fPosts.findIndex((p, i) => i > bi && p.includes('/medical-examinations'));
    const ci = fPosts.findIndex((p) => p.includes('/medical-clearances'));
    assert.ok(bi >= 0 && ti > bi && ci > ti, `Order for f${n}: BASELINE -> TRAINING -> clearance`);

    // Với f4: các request này đứng trước mọi POST /training-sessions của f4
    if (n === 4) {
      const firstSession = fPosts.findIndex((p) => p.includes('/training-sessions'));
      assert.ok(firstSession > ci, `f4 sessions after medical clearance`);
    }
  }
});

test('T6: f9 sau early (D−1)', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  const res = await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  assert.equal(res.code, 0, res.stderr);

  const f9 = api.db.users.find((u) => u.email === 't040.fighter9@example.com');
  const susp = api.db.suspensions.find((s) => s.fighterId === f9.profile.id);
  assert.ok(susp, 'f9 suspension exists');
  assert.equal(susp.reason, 'MEDICAL');
  assert.equal(susp.startsOn, '2026-11-16');
  assert.equal(susp.status, 'ENDED');

  const exam = api.db.examinations.find((e) => e.id === susp.earlyEndExaminationId);
  assert.ok(exam, 'early end exam exists');
  assert.equal(exam.examinedAt.slice(0, 10), '2026-11-16');
  assert.equal(exam.scope, 'TRAINING');
});

test('T7: f11 sau lần chạy chính', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  const res = await runSeed(api, { now: DEMO_DAY });
  assert.equal(res.code, 0, res.stderr);

  const f11 = api.db.users.find((u) => u.email === 't040.fighter11@example.com');
  const susp = api.db.suspensions.find((s) => s.fighterId === f11.profile.id);
  assert.ok(susp, 'f11 suspension exists');
  assert.equal(susp.reason, 'MEDICAL');
  assert.equal(susp.issuedBy, 'CLUB');
  assert.equal(susp.startsOn, '2026-11-17');
  const suspRes = await (await api.fetch(`http://fake.invalid/suspensions?fighterId=${f11.profile.id}`, { headers: { authorization: 'Bearer tok-coach' } })).json();
  const rows = Array.isArray(suspRes.data) ? suspRes.data : suspRes.data?.data;
  const suspFromApi = rows.find((s) => s.id === susp.id);
  assert.equal(suspFromApi.status, 'ACTIVE');

  // Có phiếu TRAINING của Thu ngày 2026-11-17, ghi sau khi tạo đình chỉ
  const suspIndex = api.requests.findIndex((r) => r.method === 'POST' && r.path === '/suspensions' && r.body?.fighterId === f11.profile.id);
  const examIndex = api.requests.findIndex((r) => r.method === 'POST' && r.path.includes('/medical-examinations') && r.body?.examinedAt?.startsWith('2026-11-17'));
  assert.ok(suspIndex >= 0 && examIndex > suspIndex, 'TRAINING exam recorded AFTER suspension');

  // Không có end-early
  assert.ok(!api.requests.some((r) => r.path === `/suspensions/${susp.id}/end-early`));
});

test('T8: f12', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const f12 = api.db.users.find((u) => u.email === 't040.fighter12@example.com');
  const post = api.requests.find((r) => r.method === 'POST' && r.path === '/suspensions' && r.body?.fighterId === f12.profile.id);
  assert.ok(post, 'f12 suspension POST exists');
  assert.equal(post.body.reason, 'MEDICAL');
  assert.equal(post.body.issuedBy, 'ORGANIZER');
  assert.equal(post.body.issuerReference, 'QĐ 12/BTC – Giải MMA mở rộng TP.HCM');
  assert.equal(post.body.days, 30);
});

test('T9: f13', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const f13 = api.db.users.find((u) => u.email === 't040.fighter13@example.com');
  const susp = api.db.suspensions.find((s) => s.fighterId === f13.profile.id);

  // Đúng một yêu cầu khám OPEN, gửi bằng token HLV
  const reviewPosts = api.requests.filter((r) => r.method === 'POST' && r.path.includes('/medical-review-requests') && r.path.includes(f13.profile.id));
  assert.equal(reviewPosts.length, 1);
  assert.equal(reviewPosts[0].token, 'tok-coach');
  const req = api.db.reviewRequests.find((r) => r.fighterId === f13.profile.id);
  assert.equal(req.status, 'OPEN');

  // Không có phiếu TRAINING nào của Thu cho f13 có ngày >= startsOn của đình chỉ f13
  const lateExams = api.db.examinations.filter((e) => e.fighterId === f13.profile.id && e.scope === 'TRAINING' && e.examinedAt.slice(0, 10) >= susp.startsOn);
  assert.equal(lateExams.length, 0);
});

test('T10: f14', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const f14 = api.db.users.find((u) => u.email === 't040.fighter14@example.com');
  const bout = api.db.bouts.find((b) => b.fighterId === f14.profile.id);
  assert.ok(bout, 'f14 bout exists');

  const rs = api.db.rulesets.find((r) => r.id === bout.rulesetId);
  assert.ok(rs.name.includes('AIBA'), 'ruleset AIBA');
  assert.equal(bout.weightClassCode, '71');
  assert.equal(bout.status, 'CAMP');

  assert.ok(!api.requests.some((r) => r.path.includes(`/bouts/${bout.id}/fight-week`)));
  assert.ok(!api.requests.some((r) => r.path.includes('/requirements/')));
});

test('T11: f15', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const f15 = api.db.users.find((u) => u.email === 't040.fighter15@example.com');
  const weights = api.db.measurements.filter((m) => m.fighterId === f15.profile.id);
  const latestWeight = weights.at(-1);
  assert.equal(latestWeight.weightKg, 77);
  assert.equal(latestWeight.measuredAt.slice(0, 10), '2026-11-16');

  const bout = api.db.bouts.find((b) => b.fighterId === f15.profile.id);
  assert.equal(bout.status, 'FIGHT_WEEK');
  assert.equal(bout.weighInAt.slice(0, 10), '2026-11-19');
});

test('T12: f16', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const f16 = api.db.users.find((u) => u.email === 't040.fighter16@example.com');
  const bout = api.db.bouts.find((b) => b.fighterId === f16.profile.id);

  const weighInPost = api.requests.find((r) => r.method === 'POST' && r.path === `/bouts/${bout.id}/weigh-in`);
  assert.ok(weighInPost);
  assert.equal(weighInPost.body.weightKg, 71.2);

  const catchweightPost = api.requests.find((r) => r.method === 'POST' && r.path === `/bouts/${bout.id}/catchweight`);
  assert.ok(catchweightPost);
  assert.equal(catchweightPost.body.catchweightKg, 72);

  assert.equal(bout.status, 'WEIGHED_IN');
});

test('T13: f17', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const f17 = api.db.users.find((u) => u.email === 't040.fighter17@example.com');
  const bout = api.db.bouts.find((b) => b.fighterId === f17.profile.id);

  const cancelPosts = api.requests.filter((r) => r.method === 'POST' && r.path === `/bouts/${bout.id}/cancel`);
  assert.equal(cancelPosts.length, 1);
  assert.equal(cancelPosts[0].body.reason, 'Đối thủ rút');
  assert.equal(bout.status, 'CANCELLED');

  // Chạy lại không gọi cancel lần nữa
  const before = api.requests.length;
  await runSeed(api, { now: DEMO_DAY });
  const repeatCancels = api.requests.slice(before).filter((r) => r.method === 'POST' && r.path === `/bouts/${bout.id}/cancel`);
  assert.equal(repeatCancels.length, 0);
});

test('T14: Thiếu DEMO_SEED_COACH_PASSWORD (hoặc _EMAIL, hoặc biến bác sĩ), chạy thật', async () => {
  for (const varName of ['DEMO_SEED_COACH_EMAIL', 'DEMO_SEED_COACH_PASSWORD', 'DEMO_SEED_DOCTOR_EMAIL', 'DEMO_SEED_DOCTOR_PASSWORD']) {
    const env = { ...ENV };
    delete env[varName];
    const { code, stderr } = await runSeed(null, { env, now: DEMO_DAY });
    assert.notEqual(code, 0);
    assert.match(stderr, new RegExp(varName));
  }
});

test('T15: GET /users?search=<coach email>&role=COACH trả rỗng', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  api.db.users = api.db.users.filter((u) => u.role !== 'COACH');

  const { code, stderr } = await runSeed(api, { now: DEMO_DAY });
  assert.notEqual(code, 0);
  assert.match(stderr, /Không thấy HLV với email/);

  // Không có request ghi nào sau đó
  assert.equal(creatingWrites(api.requests).length, 0);
});

test('T16: --stage foo', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  const { code, stderr } = await runSeed(api, { argv: ['--stage', 'foo'], now: DEMO_DAY });
  assert.notEqual(code, 0);
  assert.match(stderr, /early/);
  assert.equal(api.requests.length, 0);
});

test('T17: --only clearance lúc D−1', async () => {
  const api1 = createFakeApi({ now: DEMO_PREV_DAY });
  const res1 = await runSeed(api1, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  assert.equal(res1.code, 0, res1.stderr);

  const api2 = createFakeApi({ now: DEMO_PREV_DAY });
  const res2 = await runSeed(api2, { argv: ['--only', 'clearance'], now: DEMO_PREV_DAY });
  assert.equal(res2.code, 0, res2.stderr);

  const normalize = (r) => `${r.method} ${r.path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')}`;
  const lines1 = api1.requests.filter((r) => isWriteMethod(r.method)).map(normalize);
  const lines2 = api2.requests.filter((r) => isWriteMethod(r.method)).map(normalize);
  assert.deepEqual(lines1, lines2);
});

test('T18: --dry-run lúc D', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  const { code, stdout } = await runSeed(api, { argv: ['--dry-run'], now: DEMO_DAY });
  assert.equal(code, 0);
  assert.equal(api.requests.length, 0);

  // in đủ các dòng ghi của f1–f17, mỗi dòng có nhãn [admin], [coach] hoặc [doctor]
  for (let n = 1; n <= 17; n++) {
    assert.match(stdout, new RegExp(`f${n}`), `Dry-run output contains f${n}`);
  }
  const lines = stdout.split('\n').filter((l) => /^(POST|PUT|PATCH|DELETE) \//.test(l));
  for (const l of lines) {
    assert.match(l, /\[(admin|coach|doctor)\]/);
  }
});

test('T19: Mọi email trong plan, mọi now', () => {
  for (const iso of ['2026-11-03T03:00:00Z', '2026-11-16T02:00:00Z', '2026-11-17T02:00:00Z', '2030-01-01T00:00:00Z']) {
    const plan = buildPlan(new Date(iso));
    for (const f of plan.fighters) {
      assert.match(f.email, /@example\.com$/);
      assert.ok(!f.email.includes('@lotus-combat.test'));
    }
  }
});

// ---------------------------------------------------------------------------
// Review round 1 cases R1-R4
// ---------------------------------------------------------------------------

test('R1: chạy chính hai lần trên API giả trả currentExaminations.training → lần 2 không POST medical-examinations hay medical-clearances nào', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  const first = await runSeed(api, { now: DEMO_DAY });
  assert.equal(first.code, 0, first.stderr);
  const before = api.requests.length;
  const second = await runSeed(api, { now: DEMO_DAY });
  assert.equal(second.code, 0, second.stderr);
  const secondWrites = api.requests.slice(before).filter((r) => isWriteMethod(r.method));
  const medicalPosts = secondWrites.filter((r) => r.path.includes('/medical-examinations') || r.path.includes('/medical-clearances'));
  assert.equal(medicalPosts.length, 0);
});

test('R2: chạy chính lúc 2026-11-17T02:00:00Z (09:00 học viện) → mọi examinedAt gửi đi ≤ now; f9 (early lúc 2026-11-16T02:00:00Z) và f11 không bị 400', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  const resEarly = await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  assert.equal(resEarly.code, 0, resEarly.stderr);

  const resMain = await runSeed(api, { now: DEMO_DAY });
  assert.equal(resMain.code, 0, resMain.stderr);

  const examPosts = api.requests.filter((r) => r.method === 'POST' && r.path.includes('/medical-examinations'));
  assert.ok(examPosts.length > 0);
  for (const r of examPosts) {
    const examinedAtTime = new Date(r.body.examinedAt).getTime();
    assert.ok(examinedAtTime <= DEMO_DAY.getTime(), `${r.body.examinedAt} <= DEMO_DAY`);
  }
});

test('R3: chạy chính khi user f8 có sẵn nhưng không có đình chỉ KO → exit 0, stderr nhắc f8 cần --stage early, các võ sĩ khác vẫn chạy', async () => {
  const api = createFakeApi({ now: DEMO_DAY });
  const plan = buildPlan(DEMO_DAY);
  const f8 = plan.fighters.find((f) => f.key === 'f8');
  const profileId = randomUUID();
  api.db.users.push({
    id: randomUUID(),
    email: f8.email,
    role: 'FIGHTER',
    profile: { id: profileId, firstName: f8.profile.firstName, lastName: f8.profile.lastName },
  });

  const { code, stderr } = await runSeed(api, { now: DEMO_DAY });
  assert.equal(code, 0, stderr);
  assert.match(stderr, /Võ sĩ f8.*cần chạy --stage early hôm trước/);
  const f1 = api.db.users.find((u) => u.email === 't040.fighter1@example.com');
  const f17 = api.db.users.find((u) => u.email === 't040.fighter17@example.com');
  assert.ok(f1, 'f1 được tạo');
  assert.ok(f17, 'f17 được tạo');
});

test('R4: f16 lần 1 dừng sau weigh-in (catchweight trả 500 một lần), lần 2 → không POST weigh-in lần nữa, có đúng một POST catchweight thành công, trạng thái cuối WEIGHED_IN', async () => {
  const api = createFakeApi({ now: DEMO_DAY, failCatchweightOnce: true });
  const first = await runSeed(api, { now: DEMO_DAY });
  assert.notEqual(first.code, 0);

  const f16 = api.db.users.find((u) => u.email === 't040.fighter16@example.com');
  const bout1 = api.db.bouts.find((b) => b.fighterId === f16?.profile?.id);
  assert.ok(bout1);
  assert.equal(bout1.status, 'FIGHT_WEEK');
  assert.equal(bout1.madeWeight, false);
  assert.ok(bout1.officialWeightKg);

  const before = api.requests.length;
  const second = await runSeed(api, { now: DEMO_DAY });
  assert.equal(second.code, 0, second.stderr);

  const secondRequests = api.requests.slice(before);
  const weighInPosts = secondRequests.filter((r) => r.method === 'POST' && r.path === `/bouts/${bout1.id}/weigh-in`);
  assert.equal(weighInPosts.length, 0, 'không POST weigh-in lần nữa');

  const catchweightSecond = secondRequests.filter((r) => r.method === 'POST' && r.path === `/bouts/${bout1.id}/catchweight`);
  assert.equal(catchweightSecond.length, 1, 'có đúng một POST catchweight trong lần 2');
  assert.equal(bout1.status, 'WEIGHED_IN');
  assert.equal(bout1.catchweightKg, 72);
});

// ---------------------------------------------------------------------------
// Review round 2 cases Q1, Q3, Q4, Q5
// ---------------------------------------------------------------------------

test('Q1: sau early (2026-11-16T02:00Z) và chạy chính (2026-11-17T02:00Z) → GET medical của f9 và f11 có eligibility.training.eligible = true; mỗi exam của bác sĩ có đúng một clearance', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  const resEarly = await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  assert.equal(resEarly.code, 0, resEarly.stderr);

  const resMain = await runSeed(api, { now: DEMO_DAY });
  assert.equal(resMain.code, 0, resMain.stderr);

  const f9 = api.db.users.find((u) => u.email === 't040.fighter9@example.com');
  const f11 = api.db.users.find((u) => u.email === 't040.fighter11@example.com');
  assert.ok(f9 && f11);

  const med9 = await (await api.fetch(`http://fake.invalid/fighters/${f9.profile.id}/medical`, { headers: { authorization: 'Bearer tok-doctor' } })).json();
  const med11 = await (await api.fetch(`http://fake.invalid/fighters/${f11.profile.id}/medical`, { headers: { authorization: 'Bearer tok-doctor' } })).json();

  assert.equal(med9.data.eligibility.training.eligible, true);
  assert.equal(med11.data.eligibility.training.eligible, true);

  const docExams = api.db.examinations.filter((e) => e.scope === 'TRAINING' && (e.details?.examinationType ?? e.examinationType) !== 'BASELINE');
  for (const exam of docExams) {
    const clearancesForExam = api.db.clearances.filter((c) => c.examinationId === exam.id);
    assert.equal(clearancesForExam.length, 1, `Exam ${exam.id} must have exactly 1 clearance`);
  }
});

test('Q3: chạy early rồi chạy chính cùng ngày 2026-11-16 → exit 0, không POST /clear cho f8, stderr nhắc f8, f11–f17 vẫn được tạo', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  const resEarly = await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  assert.equal(resEarly.code, 0, resEarly.stderr);

  const resMain = await runSeed(api, { now: DEMO_PREV_DAY });
  assert.equal(resMain.code, 0, resMain.stderr);

  const clearPosts = api.requests.filter((r) => r.method === 'POST' && r.path.includes('/clear'));
  assert.equal(clearPosts.length, 0);

  assert.match(resMain.stderr, /Võ sĩ f8.*chạy --stage early đúng hôm trước/);

  for (let n = 11; n <= 17; n++) {
    const user = api.db.users.find((u) => u.email === `t040.fighter${n}@example.com`);
    assert.ok(user, `f${n} must be created`);
  }
});

test('Q4: lần 1 POST medical-clearances trả 500 một lần cho f5; lần 2 → không POST BASELINE lần nữa, đúng một clearance từ exam hiện hành, f5 eligible', async () => {
  const api = createFakeApi({ now: DEMO_DAY, failClearanceForFighter: 't040.fighter5@example.com' });
  const first = await runSeed(api, { now: DEMO_DAY });
  assert.notEqual(first.code, 0);

  const f5 = api.db.users.find((u) => u.email === 't040.fighter5@example.com');
  assert.ok(f5);

  const before = api.requests.length;
  const second = await runSeed(api, { now: DEMO_DAY });
  assert.equal(second.code, 0, second.stderr);

  const secondWrites = api.requests.slice(before).filter((r) => isWriteMethod(r.method));
  const baselinePosts = secondWrites.filter((r) => r.path === `/fighters/${f5.profile.id}/medical-examinations` && r.body?.examinationType === 'BASELINE');
  assert.equal(baselinePosts.length, 0, 'không POST BASELINE lần nữa');

  const f5Clearances = api.db.clearances.filter((c) => c.fighterId === f5.profile.id);
  assert.equal(f5Clearances.length, 1, 'đúng một clearance');

  const med5 = await (await api.fetch(`http://fake.invalid/fighters/${f5.profile.id}/medical`, { headers: { authorization: 'Bearer tok-doctor' } })).json();
  assert.equal(med5.data.eligibility.training.eligible, true, 'f5 eligible');
});

test('Q5: mọi examinedAt gửi đi ≤ now − 60 s', async () => {
  const api = createFakeApi({ now: DEMO_PREV_DAY });
  await runSeed(api, { argv: ['--stage', 'early'], now: DEMO_PREV_DAY });
  await runSeed(api, { now: DEMO_DAY });

  const examPosts = api.requests.filter((r) => r.method === 'POST' && r.path.includes('/medical-examinations'));
  assert.ok(examPosts.length > 0);

  const f9Exam = examPosts.find((r) => r.body.reason === 'Khám kết thúc đình chỉ sớm');
  assert.ok(f9Exam, 'f9 exam must be posted');
  assert.ok(new Date(f9Exam.body.examinedAt).getTime() <= DEMO_PREV_DAY.getTime() - 60_000, 'f9 examinedAt <= DEMO_PREV_DAY - 60s');

  const f11Exam = examPosts.find((r) => r.body.reason === 'Khám đánh giá sau đình chỉ y tế');
  assert.ok(f11Exam, 'f11 exam must be posted');
  assert.ok(new Date(f11Exam.body.examinedAt).getTime() <= DEMO_DAY.getTime() - 60_000, 'f11 examinedAt <= DEMO_DAY - 60s');

  for (const r of examPosts) {
    const t = new Date(r.body.examinedAt).getTime();
    assert.ok(t <= DEMO_DAY.getTime() - 60_000, `${r.body.examinedAt} <= DEMO_DAY - 60s`);
  }
});
