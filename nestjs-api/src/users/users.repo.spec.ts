import { PgDialect } from 'drizzle-orm/pg-core';
import { buildUserDirectorySearch } from './users.repo.js';

describe('user directory query', () => {
  it('searches the persisted display name used by invited accounts', () => {
    const query = new PgDialect().sqlToQuery(
      buildUserDirectorySearch('Linh Nguyen'),
    );
    expect(query.sql).toContain('"users"."display_name" ilike');
    expect(query.params).toContain('%Linh Nguyen%');
  });
});
