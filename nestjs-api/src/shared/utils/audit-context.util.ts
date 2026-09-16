import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../../database/database.module.js';

export type Transaction = Parameters<
  Parameters<DrizzleDB['transaction']>[0]
>[0];
export type DatabaseExecutor = DrizzleDB | Transaction;

/**
 * Sets PostgreSQL transaction-local audit context parameters:
 * - `request.jwt.claims`: claims containing `sub` (actor subject/authUserId)
 * - `mma.request_id`: correlation ID for audit log tracking
 */
export async function setAuditContext(
  subject: string,
  requestId: string,
  database: DatabaseExecutor,
): Promise<void> {
  await database.execute(sql`
    select
      set_config('request.jwt.claims', ${JSON.stringify({ sub: subject })}, true),
      set_config('mma.request_id', ${requestId}, true)
  `);
}
