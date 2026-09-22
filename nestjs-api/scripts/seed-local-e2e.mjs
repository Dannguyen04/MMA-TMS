import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;
const expectedDatabase = 'martial_arts_tracker_e2e';
const password = process.env.E2E_PASSWORD ?? '';
if (password.length < 12) {
  throw new Error('E2E_PASSWORD phải có ít nhất 12 ký tự.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL là bắt buộc cho E2E seed.');
}

const people = [
  [
    '101',
    '201',
    '301',
    'minh.tran@lotus-combat.test',
    'FIGHTER',
    'Minh',
    'Tran',
  ],
  [
    '102',
    '202',
    '302',
    'lucas.ferreira@lotus-combat.test',
    'FIGHTER',
    'Lucas',
    'Ferreira',
  ],
  [
    '103',
    '203',
    '303',
    'diego.alvarez@lotus-combat.test',
    'FIGHTER',
    'Diego',
    'Alvarez',
  ],
  [
    '104',
    '204',
    '304',
    'bao.nguyen@lotus-combat.test',
    'FIGHTER',
    'Bao',
    'Nguyen',
  ],
  [
    '105',
    '205',
    '305',
    'kenji.morita@lotus-combat.test',
    'FIGHTER',
    'Kenji',
    'Morita',
  ],
  [
    '106',
    '206',
    '306',
    'rafael.costa@lotus-combat.test',
    'COACH',
    'Rafael',
    'Costa',
  ],
  [
    '107',
    '207',
    '307',
    'anna.volkova@lotus-combat.test',
    'COACH',
    'Anna',
    'Volkova',
  ],
  ['108', '208', '308', 'thu.le@lotus-combat.test', 'DOCTOR', 'Thu', 'Le'],
  [
    '109',
    '209',
    '309',
    'samuel.brooks@lotus-combat.test',
    'DOCTOR',
    'Samuel',
    'Brooks',
  ],
  [
    '110',
    '210',
    '310',
    'nora.whitfield@lotus-combat.test',
    'ADMIN',
    'Nora',
    'Whitfield',
  ],
].map(
  ([
    userSuffix,
    subjectSuffix,
    profileSuffix,
    email,
    role,
    firstName,
    lastName,
  ]) => ({
    userId: `11111111-1111-4111-8111-111111111${userSuffix}`,
    subjectId: `22222222-2222-4222-8222-222222222${subjectSuffix}`,
    profileId: `33333333-3333-4333-8333-333333333${profileSuffix}`,
    email,
    role,
    firstName,
    lastName,
  }),
);

function scrypt(value, salt) {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      value,
      salt,
      64,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

async function passwordHash(value) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(value, salt);
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const database = await client.query('select current_database() as name');
  if (database.rows[0]?.name !== expectedDatabase) {
    throw new Error(
      `E2E seed từ chối database: ${database.rows[0]?.name ?? 'unknown'}`,
    );
  }

  await client.query('begin');
  await client.query('select pg_advisory_xact_lock($1, $2)', [20260921, 1200]);
  const encodedPassword = await passwordHash(password);

  for (const person of people) {
    await client.query(
      'insert into auth.users(id) values ($1) on conflict (id) do nothing',
      [person.subjectId],
    );
    await client.query(
      `insert into public.users(id, auth_user_id, email, role, is_active, deleted_at)
       values ($1, $2, $3, $4, true, null)
       on conflict (id) do update
       set auth_user_id = excluded.auth_user_id,
           email = excluded.email,
           role = excluded.role,
           is_active = true,
           deleted_at = null,
           updated_at = now()`,
      [person.userId, person.subjectId, person.email, person.role],
    );

    if (person.role === 'FIGHTER') {
      await client.query(
        `insert into public.fighters(
           id, user_id, first_name, last_name, nickname, sex, date_of_birth,
           nationality, weight_class, height_cm, reach_cm, weight_kg,
           body_fat_pct, resting_heart_rate, dominant_stance, training_level,
           primary_discipline, record_wins, record_losses, record_draws, gym
         )
         values (
           $1, $2, $3, $4, null, 'MALE', '2000-01-01', 'Vietnamese',
           'LIGHTWEIGHT', 175, 178, 70, 14, 58, 'ORTHODOX', 'AMATEUR',
           'Mixed Martial Arts', 0, 0, 0, 'Lotus Combat Academy'
         )
         on conflict (id) do update
         set first_name = excluded.first_name,
             last_name = excluded.last_name,
             nationality = excluded.nationality,
             height_cm = excluded.height_cm,
             reach_cm = excluded.reach_cm,
             weight_kg = excluded.weight_kg,
             body_fat_pct = excluded.body_fat_pct,
             resting_heart_rate = excluded.resting_heart_rate,
             dominant_stance = excluded.dominant_stance,
             training_level = excluded.training_level,
             primary_discipline = excluded.primary_discipline,
             is_active = true,
             deleted_at = null,
             updated_at = now()`,
        [person.profileId, person.userId, person.firstName, person.lastName],
      );
    } else if (person.role === 'COACH') {
      await client.query(
        `insert into public.coaches(id, user_id, first_name, last_name, specialization)
         values ($1, $2, $3, $4, 'MMA')
         on conflict (id) do update
         set first_name = excluded.first_name,
             last_name = excluded.last_name,
             is_active = true,
             deleted_at = null,
             updated_at = now()`,
        [person.profileId, person.userId, person.firstName, person.lastName],
      );
    } else if (person.role === 'DOCTOR') {
      await client.query(
        `insert into public.sports_doctors(id, user_id, first_name, last_name, license_number, specialization)
         values ($1, $2, $3, $4, $5, 'Sports medicine')
         on conflict (id) do update
         set first_name = excluded.first_name,
             last_name = excluded.last_name,
             is_active = true,
             deleted_at = null,
             updated_at = now()`,
        [
          person.profileId,
          person.userId,
          person.firstName,
          person.lastName,
          `E2E-${person.profileId.slice(-3)}`,
        ],
      );
    }

    await client.query(
      `insert into public.local_auth_credentials(user_id, password_hash)
       values ($1, $2)
       on conflict (user_id) do update
       set password_hash = excluded.password_hash, updated_at = now()`,
      [person.userId, encodedPassword],
    );
  }

  const admin = people.find((person) => person.role === 'ADMIN');
  const fighters = people.filter((person) => person.role === 'FIGHTER');
  const coaches = people.filter((person) => person.role === 'COACH');
  const doctors = people.filter((person) => person.role === 'DOCTOR');
  for (const [index, fighter] of fighters.entries()) {
    const coach = coaches[index < 3 ? 0 : 1];
    const doctor = doctors[index < 3 ? 0 : 1];
    await client.query(
      `insert into public.coach_fighters(coach_id, fighter_id, assigned_by_id, starts_at)
       values ($1, $2, $3, now() - interval '30 days')
       on conflict (coach_id, fighter_id) where ends_at is null do nothing`,
      [coach.profileId, fighter.profileId, admin.userId],
    );
    await client.query(
      `insert into public.doctor_fighters(doctor_id, fighter_id, assigned_by_id, starts_at)
       values ($1, $2, $3, now() - interval '30 days')
       on conflict (doctor_id, fighter_id) where ends_at is null do nothing`,
      [doctor.profileId, fighter.profileId, admin.userId],
    );
  }

  await client.query('commit');
  console.log(`E2E seed hoàn tất: ${people.length} tài khoản.`);
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
