import pg from "pg";
import { config } from "./config.js";

// node-postgres parses the `date` SQL type (OID 1082) into a JS Date by
// default, which then serializes as a full ISO timestamp
// ("1990-01-01T00:00:00.000Z") instead of the plain "YYYY-MM-DD" every
// type in packages/types and every <input type="date"> expects. Keep it as
// the raw string Postgres sends back.
pg.types.setTypeParser(1082, (value: string) => value);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export type QueryParams = ReadonlyArray<unknown>;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: QueryParams,
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

/** camelCase <-> snake_case is done by hand in each repo module's row mapper
 * rather than a generic recursive converter — explicit mapping makes it
 * obvious exactly which columns a route can rely on. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
