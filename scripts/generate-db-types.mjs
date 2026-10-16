// Génère les types depuis les catalogues PostgreSQL, sans projet distant.
// PGlite vérifie la migration réelle ; Supabase CLI peut aussi produire ces types.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const db = new PGlite();
try {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  const { rows: columns } = await db.query(
    "select table_name,column_name,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
  );
  const { rows: relations } = await db.query(
    `select c.conname,cl.relname source,cr.relname target,array_agg(a.attname order by k.ord) cols,array_agg(b.attname order by k.ord) refs from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_namespace n on n.oid=cl.relnamespace join pg_class cr on cr.oid=c.confrelid join lateral unnest(c.conkey,c.confkey) with ordinality k(a,b,ord) on true join pg_attribute a on a.attrelid=cl.oid and a.attnum=k.a join pg_attribute b on b.attrelid=cr.oid and b.attnum=k.b where c.contype='f' and n.nspname='public' group by c.conname,cl.relname,cr.relname`,
  );
  const names = [...new Set(columns.map((c) => c.table_name))];
  const type = (c) =>
    c.udt_name.startsWith('_')
      ? 'string[]'
      : ['int2', 'int4', 'int8', 'numeric', 'float4', 'float8'].includes(c.udt_name)
        ? 'number'
        : c.udt_name === 'bool'
          ? 'boolean'
          : 'string';
  let source = `// Généré par npm run db:types depuis la migration versionnée.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n`;
  for (const name of names) {
    const cols = columns.filter((c) => c.table_name === name);
    source += `${name}: {\n`;
    for (const mode of ['Row', 'Insert', 'Update']) {
      source += `${mode}: {\n`;
      for (const c of cols) {
        const optional =
          mode === 'Update' ||
          (mode === 'Insert' && (c.is_nullable === 'YES' || c.column_default !== null));
        source += `${c.column_name}${optional ? '?' : ''}: ${type(c)}${c.is_nullable === 'YES' ? ' | null' : ''};\n`;
      }
      source += '};\n';
    }
    source += 'Relationships: [\n';
    for (const r of relations.filter((r) => r.source === name))
      source += `{foreignKeyName:${JSON.stringify(r.conname)};columns:${JSON.stringify(r.cols)};isOneToOne:false;referencedRelation:${JSON.stringify(r.target)};referencedColumns:${JSON.stringify(r.refs)}} ,\n`;
    source += '];};\n';
  }
  source += `}; Views: {[_ in never]: never}; Enums: {[_ in never]: never}; CompositeTypes: {[_ in never]: never}; Functions: {
read_programs: {Args: Record<string, never>; Returns: Json};
read_workouts: {Args: {page_offset?:number;page_size?:number;since_date?:string|null;only_id?:string|null;only_exercise?:string|null}; Returns: Json};
save_program: {Args: {payload: Json}; Returns: number};
save_workout: {Args: {payload: Json}; Returns: number};
resolve_login: {Args: {login: string}; Returns: string|null};
register_login: {Args: {login: string;identity:string;technical_email:string}; Returns:undefined};
lookup_login_user: {Args: {login: string}; Returns: string|null};
consume_login_attempt: {Args: {bucket:string;max_attempts:number}; Returns:boolean};
} } };\n`;
  writeFileSync('src/lib/database.types.ts', source);
  console.log(`${names.length} tables typées depuis PostgreSQL.`);
} finally {
  await db.close();
}
