// T-040 B test cases S1-S18. Run: node --test scripts/demo-seed.test.mjs
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
  DEMO_SEED_USER_PASSWORD: 'not-a-real-password',
};
const NOW = new Date('2026-11-03T03:00:00Z'); // 10:00 UTC+7

function createFakeApi() {
  const db = { users: [], assignments: [], measurements: [], plans: [], sessions: [], suspensions: [], bouts: [], rounds: [], suggestions: [], rulesets: [{ id: randomUUID(), name: 'MMA – VMMAF 2021', sport: 'MMA' }] };
  const requests = [];
  const ok = (data, status = 200) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status });
  const fail = (status, code) => new Response(JSON.stringify({ success: false, error: { code } }), { status });
  const NEXT = { camp: ['SCHEDULED', 'CAMP'], 'fight-week': ['CAMP', 'FIGHT_WEEK'], 'weigh-in': ['FIGHT_WEEK', 'WEIGHED_IN'], result: ['WEIGHED_IN', 'COMPLETED'] };

  async function fetch(url, init = {}) {
    const u = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    const token = init.headers?.authorization?.replace('Bearer ', '');
    const path = u.pathname;
    const q = Object.fromEntries(u.searchParams);
    requests.push({ method, path, body });
    const route = `${method} ${path}`;
    let m;

    if (route === 'POST /auth/login') return ok({ session: { accessToken: 'tok' } });
    if (!token) return fail(401, 'AUTHENTICATION_REQUIRED');

    if (route === 'GET /users') return ok({ items: db.users.filter((x) => x.email.includes(q.search ?? '') && (!q.role || x.role === q.role)) });
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
    if ((m = path.match(/^\/fighters\/([^/]+)\/measurements$/))) {
      const rows = db.measurements.filter((x) => x.fighterId === m[1]);
      if (method === 'GET') return ok({ data: rows.slice(0, Number(q.limit ?? 20)), total: rows.length });
      const row = { id: randomUUID(), fighterId: m[1], ...body };
      db.measurements.push(row);
      return ok(row, 201);
    }
    for (const [name, key] of [['/training-plans', 'plans'], ['/training-sessions', 'sessions'], ['/suspensions', 'suspensions']]) {
      if (path !== name) continue;
      if (method === 'GET') {
        const rows = db[key].filter((x) => !q.fighterId || x.fighterId === q.fighterId);
        return ok({ data: rows, total: rows.length });
      }
      const row = { id: randomUUID(), deletedAt: null, clearedAt: null, ...body };
      db[key].push(row);
      return ok(row, 201);
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
      if (method === 'POST' && NEXT[sub]) {
        const [from, to] = NEXT[sub];
        if (bout.status !== from) return fail(409, 'BOUT_INVALID_TRANSITION');
        bout.status = to;
        if (sub === 'camp') bout.trainingPlanId = body.trainingPlanId;
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
  return { fetch, db, requests };
}

async function runSeed(api, { argv = [], env = ENV, now = NOW } = {}) {
  const lines = [];
  const errors = [];
  const code = await run({ argv, env, now, fetch: api?.fetch ?? (() => assert.fail('fetch must not be called')), out: (l) => lines.push(l), err: (l) => errors.push(l) });
  return { code, stdout: lines.join('\n'), stderr: errors.join('\n') };
}
const writes = (requests) => requests.filter((r) => isWriteMethod(r.method));
const creatingWrites = (requests) => writes(requests).filter((r) => r.path !== '/auth/login');

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
  assert.equal(api.db.users.length, 8);
  assert.equal(api.db.bouts.find((b) => b.eventName.includes('Võ sĩ 6')).status, 'COMPLETED');

  const before = api.requests.length;
  const second = await runSeed(api);
  assert.equal(second.code, 0, second.stderr);
  const m2 = second.stdout.match(/created=(\d+) existing=(\d+)/);
  assert.ok(m2, 'run 2 prints created/existing');
  assert.equal(Number(m2[1]), 0);
  assert.ok(Number(m2[2]) > 0);
  assert.deepEqual(creatingWrites(api.requests.slice(before)), []);
  assert.equal(api.db.users.length, 8);
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
  assert.equal(api.db.users.length, 8);
  assert.equal(api.db.bouts.filter((b) => b.eventName === f2.bout.eventName).length, 1);
  assert.equal(api.db.bouts.length, 5);
});

test('S4: every email in the plan ends with @example.com, for any now', () => {
  for (const iso of ['2026-11-03T03:00:00Z', '2026-12-31T16:59:00Z', '2027-02-28T23:00:00Z', '2030-06-15T12:00:00Z']) {
    const plan = buildPlan(new Date(iso));
    const emails = [plan.coach.email, ...plan.fighters.map((f) => f.email)];
    assert.equal(emails.length, 8);
    for (const e of emails) assert.match(e, /@example\.com$/);
  }
});

test('S5: missing URL or token exits non-zero, names the variable, sends nothing', async () => {
  for (const drop of [['DEMO_SEED_API_URL'], ['DEMO_SEED_ADMIN_EMAIL', 'DEMO_SEED_ADMIN_PASSWORD']]) {
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

const f7Suspension = (api) => {
  const id = api.db.users.find((u) => u.email === 't040.fighter7@example.com')?.profile.id;
  return { id, posts: api.requests.filter((r) => r.method === 'POST' && r.body?.fighterId === id) };
};
const assertMedicalOneDay = (body) => {
  assert.equal(body.reason, 'MEDICAL');
  assert.equal(body.days, 1);
  assert.ok(body.startsOn === undefined || body.startsOn === academyDate(NOW), `startsOn ${body.startsOn}`);
};

test('S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it', async () => {
  const api = createFakeApi();
  const plan = buildPlan(NOW);
  const others = plan.fighters.filter((f) => f.key !== 'f7');
  const { code, stderr } = await runSeed(api, { argv: ['--only', 'clearance'] });
  assert.equal(code, 0, stderr);

  const { id, posts } = f7Suspension(api);
  assert.ok(id, 'fighter 7 user created');
  const w = creatingWrites(api.requests);
  // Coach user (empty API) + fighter 7: user, coach assignment (the backend needs it for the coach calls), bout, suspension.
  assert.deepEqual(w.map((r) => r.path), ['/users', '/users', `/fighters/${id}/coaches`, '/suspensions', '/bouts']);
  assert.deepEqual(w.filter((r) => r.path === '/users').map((r) => r.body.user.email), [plan.coach.email, 't040.fighter7@example.com']);
  assertMedicalOneDay(posts.find((r) => r.path === '/suspensions').body);
  for (const f of others) {
    assert.ok(!w.some((r) => JSON.stringify(r.body ?? {}).includes(f.email)), `no write for ${f.email}`);
    if (f.bout) assert.ok(!w.some((r) => r.body?.eventName === f.bout.eventName), `no bout for ${f.key}`);
  }
  assert.ok(w.every((r) => r.path === '/users' || r.body?.fighterId === id || r.path === `/fighters/${id}/coaches`));

  const before = api.requests.length;
  const second = await runSeed(api);
  assert.equal(second.code, 0, second.stderr);
  const again = creatingWrites(api.requests.slice(before));
  assert.ok(!again.some((r) => r.path === '/users' && r.body.user.email === 't040.fighter7@example.com'));
  assert.ok(!again.some((r) => r.body?.fighterId === id || r.path.includes(id)), 'no write for fighter 7');
  assert.equal(api.db.suspensions.filter((x) => x.fighterId === id).length, 1);
  assert.equal(api.db.bouts.filter((x) => x.fighterId === id).length, 1);
});

test('S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6', async () => {
  const api = createFakeApi();
  const { code, stderr } = await runSeed(api);
  assert.equal(code, 0, stderr);
  for (const f of buildPlan(NOW).fighters) assert.ok(api.db.users.some((u) => u.email === f.email), f.email);
  const { id, posts } = f7Suspension(api);
  const bout = api.db.bouts.find((b) => b.fighterId === id);
  assert.equal(bout.status, 'SCHEDULED');
  assert.ok(academyDate(new Date(bout.boutAt)) > '2026-11-10');
  const suspensions = posts.filter((r) => r.path === '/suspensions');
  assert.equal(suspensions.length, 1);
  assertMedicalOneDay(suspensions[0].body);
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
