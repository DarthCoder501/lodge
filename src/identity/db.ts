import { Pool } from "pg";

// shortcut: direct Postgres URL on port 5432. Use the session pooler URL when
// many short-lived servers share this database.

let pool: Pool | undefined;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  pool ??= new Pool({
    connectionString,
    max: 10,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function exec(sql: string): Promise<void> {
  await getPool().query(sql);
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
