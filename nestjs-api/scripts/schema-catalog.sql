-- Read-only catalog used by the isolated tests to compare SQL and Drizzle metadata.
SELECT jsonb_build_object(
  'enums',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'values',
    (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)))
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'),
  'tables',(SELECT jsonb_agg(jsonb_build_object(
    'name',t.relname,
    'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,
      'definition',pg_get_constraintdef(c.oid),
      'columns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num),
      'refTable',(SELECT relname FROM pg_class WHERE oid=c.confrelid),
      'refSchema',(SELECT nspname FROM pg_namespace WHERE oid=(SELECT relnamespace FROM pg_class WHERE oid=c.confrelid)),
      'refColumns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num),
      'deleteAction',c.confdeltype,'updateAction',c.confupdtype)),'[]')
      FROM pg_constraint c WHERE c.conrelid=t.oid AND c.contype IN ('p','u','f','c')),
    'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',ci.relname,'unique',i.indisunique,'method',am.amname,
      'columns',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid,k,true) ORDER BY k) FROM generate_series(1,i.indnkeyatts) k),
      'where',pg_get_expr(i.indpred,i.indrelid))),'[]') FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_am am ON am.oid=ci.relam
      WHERE i.indrelid=t.oid AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid AND c.contype IN ('p','u','x')))
  ) ORDER BY t.relname) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relkind='r')
);
