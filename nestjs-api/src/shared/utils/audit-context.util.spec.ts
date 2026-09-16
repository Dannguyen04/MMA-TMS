import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  type DatabaseExecutor,
  setAuditContext,
} from './audit-context.util.js';

describe('setAuditContext', () => {
  it('binds the verified subject and request id as transaction-local settings', async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const database = { execute } as unknown as DatabaseExecutor;

    await setAuditContext('verified-subject', 'request-id', database);

    expect(execute).toHaveBeenCalledTimes(1);
    const statement = execute.mock.calls[0]?.[0] as SQL;
    const query = new PgDialect().sqlToQuery(statement);
    expect(query.sql).toContain("set_config('request.jwt.claims'");
    expect(query.sql).toContain("set_config('mma.request_id'");
    expect(query.params).toEqual([
      JSON.stringify({ sub: 'verified-subject' }),
      'request-id',
    ]);
  });
});
