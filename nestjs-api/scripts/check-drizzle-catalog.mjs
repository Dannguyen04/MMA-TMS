import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [schemaArg, catalogArg] = process.argv.slice(2);
if (!schemaArg || !catalogArg)
  throw new Error(
    'Usage: node scripts/check-drizzle-catalog.mjs <compiled-schema.js> <isolated-catalog.json>',
  );
const schemaPath = resolve(schemaArg);
const schema = await import(pathToFileURL(schemaPath));
const requireSchema = createRequire(schemaPath);
const { getTableConfig, PgDialect } = requireSchema('drizzle-orm/pg-core');
const dialect = new PgDialect();
const catalog = JSON.parse(readFileSync(resolve(catalogArg), 'utf8'));
const configs = new Map(
  Object.values(schema)
    .filter((x) => x?.[Symbol.for('drizzle:Name')])
    .map((t) => {
      const c = getTableConfig(t);
      return [c.name, c];
    }),
);
const render = (s) => dialect.sqlToQuery(s).sql;
const normalize = (s) => (s == null ? null : s.replace(/\s+/g, ' ').trim());
const actions = {
  r: 'restrict',
  a: 'no action',
  c: 'cascade',
  n: 'set null',
  d: 'set default',
};
assert.deepEqual(
  [...configs.keys()].sort(),
  catalog.tables.map((t) => t.name).sort(),
);
for (const table of catalog.tables) {
  const actual = configs.get(table.name);
  assert.deepEqual(
    actual.columns.map((c) => c.name),
    table.columns.map((c) => c.name),
    `${table.name}: columns`,
  );
  for (const column of table.columns) {
    const c = actual.columns.find((c) => c.name === column.name);
    assert.equal(
      c.notNull,
      column.required,
      `${table.name}.${column.name}: nullability`,
    );
    assert.equal(
      normalize(c.getSQLType()).replace(/,\s*/g, ','),
      normalize(column.type).replace(/,\s*/g, ','),
      `${table.name}.${column.name}: type`,
    );
    assert.equal(
      c.default ? normalize(render(c.default)) : null,
      normalize(column.default),
      `${table.name}.${column.name}: default`,
    );
  }
  assert.equal(
    actual.checks.length,
    table.constraints.filter((c) => c.type === 'c').length,
    `${table.name}: check count`,
  );
  assert.equal(
    actual.foreignKeys.length,
    table.constraints.filter((c) => c.type === 'f').length,
    `${table.name}: FK count`,
  );
  assert.equal(
    actual.uniqueConstraints.length,
    table.constraints.filter((c) => c.type === 'u').length,
    `${table.name}: unique count`,
  );
  for (const c of table.constraints) {
    if (c.type === 'c')
      assert.equal(
        normalize(render(actual.checks.find((x) => x.name === c.name).value)),
        normalize(c.definition.slice(7, -1)),
        `${c.name}: check`,
      );
    if (c.type === 'p')
      assert.deepEqual(
        actual.primaryKeys
          .find((x) => x.getName() === c.name)
          .columns.map((x) => x.name),
        c.columns,
        `${c.name}: PK`,
      );
    if (c.type === 'u')
      assert.deepEqual(
        actual.uniqueConstraints
          .find((x) => x.name === c.name)
          .columns.map((x) => x.name),
        c.columns,
        `${c.name}: unique`,
      );
    if (c.type === 'f') {
      const fk = actual.foreignKeys.find((x) => x.getName() === c.name),
        ref = fk.reference();
      assert.deepEqual(
        ref.columns.map((x) => x.name),
        c.columns,
        `${c.name}: local columns`,
      );
      assert.deepEqual(
        ref.foreignColumns.map((x) => x.name),
        c.refColumns,
        `${c.name}: foreign columns`,
      );
      assert.equal(
        getTableConfig(ref.foreignTable).name,
        c.refTable,
        `${c.name}: target table`,
      );
      assert.equal(fk.onDelete, actions[c.deleteAction], `${c.name}: delete`);
      assert.equal(fk.onUpdate, actions[c.updateAction], `${c.name}: update`);
    }
  }
  assert.deepEqual(
    actual.indexes.map((x) => x.config.name).sort(),
    table.indexes.map((x) => x.name).sort(),
    `${table.name}: index names`,
  );
  for (const i of table.indexes) {
    const ix = actual.indexes.find((x) => x.config.name === i.name).config;
    assert.equal(ix.unique, i.unique, `${i.name}: unique`);
    assert.equal(ix.method, i.method, `${i.name}: method`);
    assert.equal(
      ix.where ? normalize(render(ix.where)) : null,
      normalize(i.where),
      `${i.name}: predicate`,
    );
    assert.deepEqual(
      ix.columns.map((c) =>
        c.name
          ? `${c.name}${c.indexConfig.order === 'desc' ? ' DESC' : ''}`
          : render(c),
      ),
      i.columns,
      `${i.name}: columns`,
    );
  }
}
for (const e of catalog.enums) {
  const actual = Object.values(schema).find((x) => x?.enumName === e.name);
  assert.deepEqual(actual?.enumValues, e.values, `${e.name}: enum values`);
}
console.log(
  `Drizzle matches PostgreSQL: ${catalog.tables.length} tables, ${catalog.enums.length} enums, columns/defaults/checks/FKs/keys/indexes.`,
);
